#![no_std]
//! Treasury — splits the net USDC of every mint, atomically, in the mint transaction.
//!
//! Split of the net amount (basis points, 10_000 = 100%):
//!   50.0%  regenerative projects pool
//!   30.0%  recovery reserve
//!    8.0%  mine owners, pro-rata to the GBT each mine backs in this mint
//!    5.0%  exploration
//!    5.0%  marketing
//!    2.0%  tax reserve
//! Integer rounding dust goes to the recovery reserve, so the payer is always charged exactly `amount`.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
    token::Client as TokenClient, vec, Address, Env, Vec,
};

pub const BPS: i128 = 10_000;
pub const BPS_PROJECTS: i128 = 5_000;
pub const BPS_RECOVERY: i128 = 3_000;
pub const BPS_MINERS: i128 = 800;
pub const BPS_EXPLORATION: i128 = 500;
pub const BPS_MARKETING: i128 = 500;
pub const BPS_TAX: i128 = 200;

#[contracttype]
pub enum DataKey {
    Admin,
    Pools,
}

#[contracttype]
#[derive(Clone)]
pub struct Pools {
    pub projects: Address,
    pub recovery: Address,
    pub exploration: Address,
    pub marketing: Address,
    pub tax: Address,
}

/// One mine owner and the weight (grams * 1000 of GBT backed in this mint) used to pay it.
#[contracttype]
#[derive(Clone)]
pub struct MinerShare {
    pub owner: Address,
    pub weight: i128,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TreasuryError {
    NotAdmin = 1,
    InvalidAmount = 2,
    NoMiners = 3,
}

#[contract]
pub struct Treasury;

fn pools(e: &Env) -> Pools {
    e.storage().instance().get(&DataKey::Pools).unwrap()
}

#[contractimpl]
impl Treasury {
    pub fn init(e: Env, admin: Address, pools: Pools) {
        if e.storage().instance().has(&DataKey::Admin) {
            return;
        }
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Pools, &pools);
    }

    pub fn set_pools(e: Env, admin: Address, pools: Pools) {
        let stored: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored {
            panic_with_error!(&e, TreasuryError::NotAdmin);
        }
        admin.require_auth();
        e.storage().instance().set(&DataKey::Pools, &pools);
    }

    pub fn get_pools(e: Env) -> Pools {
        pools(&e)
    }

    /// (projects, recovery, miners, exploration, marketing, tax) in basis points.
    pub fn split_bps(e: Env) -> Vec<i128> {
        vec![&e, BPS_PROJECTS, BPS_RECOVERY, BPS_MINERS, BPS_EXPLORATION, BPS_MARKETING, BPS_TAX]
    }

    /// Moves `amount` of `token` from `from` to every destination in one atomic call.
    pub fn route(e: Env, token: Address, from: Address, amount: i128, miners: Vec<MinerShare>) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&e, TreasuryError::InvalidAmount);
        }
        let mut total_weight: i128 = 0;
        for m in miners.iter() {
            total_weight += m.weight;
        }
        if miners.is_empty() || total_weight <= 0 {
            panic_with_error!(&e, TreasuryError::NoMiners);
        }
        let p = pools(&e);
        let t = TokenClient::new(&e, &token);

        let to_projects = amount * BPS_PROJECTS / BPS;
        let to_miners = amount * BPS_MINERS / BPS;
        let to_exploration = amount * BPS_EXPLORATION / BPS;
        let to_marketing = amount * BPS_MARKETING / BPS;
        let to_tax = amount * BPS_TAX / BPS;

        // Miners: pro-rata to the grams each mine backs; the last one takes the rounding remainder.
        let mut paid_miners: i128 = 0;
        let n = miners.len();
        let mut i: u32 = 0;
        for m in miners.iter() {
            let share = if i == n - 1 { to_miners - paid_miners } else { to_miners * m.weight / total_weight };
            paid_miners += share;
            if share > 0 {
                t.transfer(&from, &m.owner, &share);
                e.events().publish((symbol_short!("pay_miner"), m.owner.clone()), share);
            }
            i += 1;
        }

        // Recovery reserve takes its 30% plus all rounding dust.
        let to_recovery = amount - to_projects - paid_miners - to_exploration - to_marketing - to_tax;

        let pays = [
            (p.projects, to_projects, symbol_short!("projects")),
            (p.recovery, to_recovery, symbol_short!("recovery")),
            (p.exploration, to_exploration, symbol_short!("explore")),
            (p.marketing, to_marketing, symbol_short!("marketing")),
            (p.tax, to_tax, symbol_short!("tax")),
        ];
        for (dest, value, tag) in pays.iter() {
            if *value > 0 {
                t.transfer(&from, dest, value);
                e.events().publish((symbol_short!("pay_pool"), tag.clone()), *value);
            }
        }
    }
}
