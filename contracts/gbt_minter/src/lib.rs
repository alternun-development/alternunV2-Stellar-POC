#![no_std]
//! GBT Minter — registers mines, caps issuance by their weighted resources and mints GBT against USDC.
//!
//! In one atomic transaction a mint:
//!   1. prices the request at the oracle gold price and charges a fee (default 2%) to the Alternun fee wallet;
//!   2. allocates the grams minted across the mines, pro-rata to each mine's remaining capacity;
//!   3. sends the net USDC to the treasury, which pays every mine owner in proportion to the grams its mine
//!      backs in this mint (8% of the net) and splits the rest across the protocol pools;
//!   4. mints GBT to the buyer and books the grams against each mine.
//! If any step fails, nothing happens.

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token::Client as TokenClient, Address, Env, Vec};

// Weights for mine resource categories (basis points)
const BPS: i128 = 10_000;
const W_INFERIDOS: i128 = 1_500; // 15% - Inferred resources
const W_INDICADOS: i128 = 3_000; // 30% - Indicated resources
const W_MEDIDOS: i128 = 6_000; // 60% - Measured resources
const W_PROBABLES: i128 = 5_000; // 50% - Probable reserves
const W_PROBADAS: i128 = 7_000; // 70% - Proven reserves

mod oracle {
    use soroban_sdk::{contractclient, Env};
    #[contractclient(name = "OracleClient")]
    pub trait Oracle {
        fn get_price(e: Env) -> i128; // USD/gram scaled to 1e7
    }
}

mod treasury {
    use super::MinerShare;
    use soroban_sdk::{contractclient, Address, Env, Vec};
    #[contractclient(name = "TreasuryClient")]
    pub trait Treasury {
        fn route(e: Env, token: Address, from: Address, amount: i128, miners: Vec<MinerShare>);
    }
}

mod gbt_token {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "GbtTokenClient")]
    pub trait GbtToken {
        fn mint(e: Env, to: Address, amount: i128);
    }
}

/// Same shape as `treasury::MinerShare`.
#[contracttype]
#[derive(Clone)]
pub struct MinerShare {
    pub owner: Address,
    pub weight: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct MineData {
    // quantities in grams * 1000 (3 decimals precision)
    pub inferidos_gm: i128,
    pub indicados_gm: i128,
    pub medidos_gm: i128,
    pub probables_gm: i128,
    pub probadas_gm: i128,
    pub enabled: bool,
    pub owner: Address,
}

/// Grams (x1000) of a mint backed by one mine.
#[contracttype]
#[derive(Clone)]
pub struct MineAlloc {
    pub id: u32,
    pub owner: Address,
    pub gm: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenGbt,
    TokenStable,
    Treasury,
    Oracle,
    FeeBps,   // minting fee in basis points (default 200 = 2%)
    FcBps,    // commercial factor in basis points (default 8000 = 80%)
    Paused,
    MintedGm, // total minted (grams * 1000)
    Mine(u32),
    MineMinted(u32), // grams * 1000 minted against each mine
    MaxMineId,
}

fn st(e: &Env) -> soroban_sdk::storage::Instance { e.storage().instance() }
fn read_admin(e: &Env) -> Address { st(e).get(&DataKey::Admin).unwrap() }
fn read_token_gbt(e: &Env) -> Address { st(e).get(&DataKey::TokenGbt).unwrap() }
fn read_token_stable(e: &Env) -> Address { st(e).get(&DataKey::TokenStable).unwrap() }
fn read_treasury(e: &Env) -> Address { st(e).get(&DataKey::Treasury).unwrap() }
fn read_oracle(e: &Env) -> Address { st(e).get(&DataKey::Oracle).unwrap() }
fn read_fcbps(e: &Env) -> i128 { st(e).get(&DataKey::FcBps).unwrap() }
fn read_fee_bps(e: &Env) -> i128 { st(e).get(&DataKey::FeeBps).unwrap() }
fn max_mine_id(e: &Env) -> u32 { st(e).get(&DataKey::MaxMineId).unwrap_or(0) }
fn mine_minted(e: &Env, id: u32) -> i128 { st(e).get(&DataKey::MineMinted(id)).unwrap_or(0) }

fn capacity_of_mine(m: &MineData, fc_bps: i128) -> i128 {
    let sum = m.inferidos_gm * W_INFERIDOS
        + m.indicados_gm * W_INDICADOS
        + m.medidos_gm * W_MEDIDOS
        + m.probables_gm * W_PROBABLES
        + m.probadas_gm * W_PROBADAS;
    (sum * fc_bps) / (BPS * BPS)
}

/// (id, owner, remaining capacity) of every enabled mine with capacity left.
fn open_mines(e: &Env) -> Vec<MineAlloc> {
    let fc = read_fcbps(e);
    let mut out: Vec<MineAlloc> = Vec::new(e);
    let mut i: u32 = 0;
    let max = max_mine_id(e);
    while i <= max {
        if let Some(m) = st(e).get::<_, MineData>(&DataKey::Mine(i)) {
            if m.enabled {
                let left = capacity_of_mine(&m, fc) - mine_minted(e, i);
                if left > 0 {
                    out.push_back(MineAlloc { id: i, owner: m.owner, gm: left });
                }
            }
        }
        i += 1;
    }
    out
}

/// Splits `gbt_out_gm` across open mines pro-rata to their remaining capacity.
/// The rounding remainder goes to the mine with the most capacity left.
fn allocate(e: &Env, gbt_out_gm: i128) -> Vec<MineAlloc> {
    let open = open_mines(e);
    let mut total: i128 = 0;
    let mut biggest: u32 = 0;
    let mut biggest_left: i128 = -1;
    for (idx, m) in open.iter().enumerate() {
        total += m.gm;
        if m.gm > biggest_left {
            biggest_left = m.gm;
            biggest = idx as u32;
        }
    }
    let mut out: Vec<MineAlloc> = Vec::new(e);
    if total <= 0 || gbt_out_gm <= 0 {
        return out;
    }
    let mut assigned: i128 = 0;
    for m in open.iter() {
        let gm = gbt_out_gm * m.gm / total;
        assigned += gm;
        out.push_back(MineAlloc { id: m.id, owner: m.owner, gm });
    }
    let rest = gbt_out_gm - assigned;
    if rest > 0 {
        let mut b = out.get(biggest).unwrap();
        b.gm += rest;
        out.set(biggest, b);
    }
    out
}

#[contracttype]
#[derive(Clone)]
pub struct Preview {
    pub gbt_out_gm: i128,        // grams * 1000
    pub net_stable_1e7: i128,    // net amount after fee
    pub fee_stable_1e7: i128,    // fee charged
    pub price_1e7: i128,         // USD/g (1e7 scale)
    pub meets_min: bool,         // >= 1.000 gbt (1 gram)
    pub capacity_left_gm: i128,  // remaining capacity after this mint (g*1000)
    pub exceeds_capacity: bool,  // request is larger than the capacity left: mint would be rejected
}

#[contract]
pub struct GbtMinter;

#[contractimpl]
impl GbtMinter {
    pub fn init(
        e: Env,
        admin: Address,
        token_gbt: Address,
        token_stable: Address,
        treasury: Address,
        oracle: Address,
        fee_bps: u32,
        fc_bps: u32,
    ) {
        if st(&e).has(&DataKey::Admin) { return; }
        admin.require_auth();

        st(&e).set(&DataKey::Admin, &admin);
        st(&e).set(&DataKey::TokenGbt, &token_gbt);
        st(&e).set(&DataKey::TokenStable, &token_stable);
        st(&e).set(&DataKey::Treasury, &treasury);
        st(&e).set(&DataKey::Oracle, &oracle);

        let fee = if fee_bps == 0 { 200 } else { fee_bps } as i128;
        let fc = if fc_bps == 0 { 8000 } else { fc_bps } as i128;
        st(&e).set(&DataKey::FeeBps, &fee);
        st(&e).set(&DataKey::FcBps, &fc);
        st(&e).set(&DataKey::Paused, &false);
        st(&e).set(&DataKey::MintedGm, &0i128);
    }

    pub fn set_fc_bps(e: Env, fc_bps: u32) {
        read_admin(&e).require_auth();
        st(&e).set(&DataKey::FcBps, &(fc_bps as i128));
    }

    pub fn set_fee_bps(e: Env, fee_bps: u32) {
        read_admin(&e).require_auth();
        st(&e).set(&DataKey::FeeBps, &(fee_bps as i128));
    }

    pub fn set_paused(e: Env, paused: bool) {
        read_admin(&e).require_auth();
        st(&e).set(&DataKey::Paused, &paused);
    }

    pub fn upsert_mine(
        e: Env,
        id: u32,
        owner: Address,
        inferidos_gm: i128,
        indicados_gm: i128,
        medidos_gm: i128,
        probables_gm: i128,
        probadas_gm: i128,
        enabled: bool,
    ) {
        read_admin(&e).require_auth();
        let m = MineData { inferidos_gm, indicados_gm, medidos_gm, probables_gm, probadas_gm, enabled, owner };
        st(&e).set(&DataKey::Mine(id), &m);
        if id > max_mine_id(&e) {
            st(&e).set(&DataKey::MaxMineId, &id);
        }
    }

    pub fn get_mine(e: Env, id: u32) -> Option<MineData> {
        st(&e).get(&DataKey::Mine(id))
    }

    pub fn mine_minted_gm(e: Env, id: u32) -> i128 { mine_minted(&e, id) }

    pub fn mine_capacity_gm(e: Env, id: u32) -> i128 {
        match st(&e).get::<_, MineData>(&DataKey::Mine(id)) {
            Some(m) if m.enabled => capacity_of_mine(&m, read_fcbps(&e)),
            _ => 0,
        }
    }

    /// `max_id_inclusive` is kept for interface compatibility; every registered mine is always counted.
    pub fn total_capacity_gm(e: Env, max_id_inclusive: u32) -> i128 {
        let _ = max_id_inclusive;
        let fc = read_fcbps(&e);
        let mut total: i128 = 0;
        let mut i: u32 = 0;
        let max = max_mine_id(&e);
        while i <= max {
            if let Some(m) = st(&e).get::<_, MineData>(&DataKey::Mine(i)) {
                if m.enabled { total += capacity_of_mine(&m, fc); }
            }
            i += 1;
        }
        total
    }

    pub fn available_capacity_gm(e: Env, max_id_inclusive: u32) -> i128 {
        let _ = max_id_inclusive;
        let mut total: i128 = 0;
        for m in open_mines(&e).iter() { total += m.gm; }
        total
    }

    pub fn minted_gm(e: Env) -> i128 { st(&e).get::<_, i128>(&DataKey::MintedGm).unwrap_or(0) }

    pub fn fee_bps(e: Env) -> i128 { read_fee_bps(&e) }

    pub fn fc_bps(e: Env) -> i128 { read_fcbps(&e) }

    pub fn is_paused(e: Env) -> bool { st(&e).get::<_, bool>(&DataKey::Paused).unwrap_or(false) }

    pub fn preview_mint(e: Env, amount_stable_1e7: i128, max_id_inclusive: u32) -> Preview {
        let fee_bps = read_fee_bps(&e);
        let price_1e7 = crate::oracle::OracleClient::new(&e, &read_oracle(&e)).get_price();
        let avail = Self::available_capacity_gm(e.clone(), max_id_inclusive);

        if amount_stable_1e7 <= 0 || price_1e7 <= 0 {
            return Preview {
                gbt_out_gm: 0, net_stable_1e7: 0, fee_stable_1e7: 0, price_1e7,
                meets_min: false, capacity_left_gm: avail, exceeds_capacity: false,
            };
        }

        let fee = (amount_stable_1e7 * fee_bps) / BPS;
        let net = amount_stable_1e7 - fee;

        // gbt_out_gm = floor((net / price) * 1000)
        let gbt_out_gm = (net * 1000) / price_1e7;
        let meets_min = gbt_out_gm >= 1000; // minimum 1 gram
        let exceeds = gbt_out_gm > avail;
        Preview {
            gbt_out_gm,
            net_stable_1e7: net,
            fee_stable_1e7: fee,
            price_1e7,
            meets_min,
            capacity_left_gm: if exceeds { avail } else { avail - gbt_out_gm },
            exceeds_capacity: exceeds,
        }
    }

    /// How a mint of `gbt_out_gm` would be backed by each mine (and therefore how mine owners are paid).
    pub fn preview_allocation(e: Env, gbt_out_gm: i128) -> Vec<MineAlloc> {
        allocate(&e, gbt_out_gm)
    }

    pub fn mint(e: Env, payer: Address, amount_stable_1e7: i128, max_id_inclusive: u32) {
        if Self::is_paused(e.clone()) { panic!("mint paused"); }
        payer.require_auth();

        // 1) Price, fee and capacity checks. The buyer is never charged for grams that cannot be minted.
        let p = Self::preview_mint(e.clone(), amount_stable_1e7, max_id_inclusive);
        if !p.meets_min || p.gbt_out_gm <= 0 { panic!("below minimum or zero"); }
        if p.exceeds_capacity { panic!("exceeds capacity"); }

        // 2) Which mines back this mint.
        let alloc = allocate(&e, p.gbt_out_gm);
        let mut miners: Vec<MinerShare> = Vec::new(&e);
        for a in alloc.iter() {
            if a.gm > 0 {
                miners.push_back(MinerShare { owner: a.owner.clone(), weight: a.gm });
                st(&e).set(&DataKey::MineMinted(a.id), &(mine_minted(&e, a.id) + a.gm));
                e.events().publish((symbol_short!("backed"), a.id), a.gm);
            }
        }

        // 3) Fee to Alternun, net to the treasury split (mine owners + pools), all from the payer.
        let stable = TokenClient::new(&e, &read_token_stable(&e));
        if p.fee_stable_1e7 > 0 {
            stable.transfer(&payer, &read_admin(&e), &p.fee_stable_1e7);
        }
        crate::treasury::TreasuryClient::new(&e, &read_treasury(&e))
            .route(&read_token_stable(&e), &payer, &p.net_stable_1e7, &miners);

        // 4) Mint GBT to the payer: grams*1000 -> 7-decimal units (x10^4).
        crate::gbt_token::GbtTokenClient::new(&e, &read_token_gbt(&e)).mint(&payer, &(p.gbt_out_gm * 10_000));

        // 5) Book the total.
        let prev = Self::minted_gm(e.clone());
        st(&e).set(&DataKey::MintedGm, &(prev + p.gbt_out_gm));
        e.events().publish((symbol_short!("minted"), payer), (p.gbt_out_gm, amount_stable_1e7, p.fee_stable_1e7));
    }
}
