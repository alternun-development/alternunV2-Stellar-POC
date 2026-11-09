#![no_std]
//! Project Vaults — GBT holders back regenerative projects with gold-backed collateral.
//!
//! Model (3 stages):
//! 1. Funding: users stake GBT in fixed units. Each unit is valued at the oracle gold price.
//!    A project is fully funded when staked collateral reaches 2x its loan (max 50% LTV).
//!    Every staker carries a pro-rata share of the loan (50% of the value staked) and
//!    receives pGBT 1:1 as a receipt of the staked position.
//! 2. Construction / operation: admin moves the project through its lifecycle and books profits.
//! 3. Exit: profits repay each staker's debt first; once the debt is paid (and KYC is verified)
//!    the staker gets the GBT back plus ePT, the impact token of the project.
//!
//! Amount conventions: `*_gm` = grams * 1000; token units = 7 decimals (1 g = 10_000_000);
//! USD values = 1e7 scale.
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, token::Client as TokenClient, Address, Env, String,
};

const GM_TO_UNITS: i128 = 10_000; // grams*1000 -> 7-decimal token units

#[contractclient(name = "OracleClient")]
pub trait Oracle {
    fn get_price(e: Env) -> i128;
}

#[contractclient(name = "MintableClient")]
pub trait Mintable {
    fn mint(e: Env, to: Address, amount: i128);
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum ProjectStatus {
    Proposed,
    Active,
    Funded,
    InConstruction,
    Operational,
    Completed,
    Failed,
}

#[contracttype]
#[derive(Clone)]
pub struct ProjectData {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub min_stake_unit_gm: i128,
    pub loan_amount_usd_1e7: i128,
    pub target_collateral_usd_1e7: i128,
    pub total_debt_usd_1e7: i128,
    pub stake_units_issued: u32,
    pub total_raised_usd_1e7: i128,
    pub total_staked_gm: i128,
    pub status: ProjectStatus,
    pub created_ledger: u32,
    pub funding_deadline: u32,
    pub gold_price_1e7: i128,
    pub is_finalized: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct UserParticipation {
    pub gbt_staked_gm: i128,
    pub stake_units: u32,
    pub debt_owed_usd_1e7: i128,
    pub debt_paid_usd_1e7: i128,
    pub ept_claimed: bool,
    pub ept_balance: i128,
    pub profits_claimed: i128,
    pub kyc_verified: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Oracle,
    TokenGbt,
    TokenPgbt,
    TokenEpt,
    ProjectCount,
    Project(u32),
    UserProject(Address, u32),
    ProjectProfit(u32),
    UnstakePenaltyBps,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ProjectVaultError {
    NotAdmin = 1,
    ProjectNotFound = 2,
    ProjectNotActive = 3,
    InvalidStakeAmount = 4,
    DebtNotFullyPaid = 5,
    NoProfit = 6,
    InvalidAmount = 7,
    FullyFunded = 8,
    EptAlreadyClaimed = 9,
    KycNotVerified = 10,
    ProjectNotFinalized = 11,
    NoPosition = 12,
    EptNotClaimed = 13,
    ProjectFinalized = 14,
}

fn empty_participation() -> UserParticipation {
    UserParticipation {
        gbt_staked_gm: 0,
        stake_units: 0,
        debt_owed_usd_1e7: 0,
        debt_paid_usd_1e7: 0,
        ept_claimed: false,
        ept_balance: 0,
        profits_claimed: 0,
        kyc_verified: false,
    }
}

fn require_admin(e: &Env, admin: &Address) {
    let stored: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
    if *admin != stored {
        panic_with_error!(e, ProjectVaultError::NotAdmin);
    }
    admin.require_auth();
}

fn load_project(e: &Env, id: u32) -> ProjectData {
    e.storage()
        .instance()
        .get(&DataKey::Project(id))
        .unwrap_or_else(|| panic_with_error!(e, ProjectVaultError::ProjectNotFound))
}

fn addr(e: &Env, k: DataKey) -> Address {
    e.storage().instance().get(&k).unwrap()
}

#[contract]
pub struct ProjectVaults;

#[contractimpl]
impl ProjectVaults {
    pub fn init(
        e: Env,
        admin: Address,
        oracle: Address,
        token_gbt: Address,
        token_pgbt: Address,
        token_ept: Address,
        unstake_penalty_bps: i128,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            return;
        }
        admin.require_auth();
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Oracle, &oracle);
        s.set(&DataKey::TokenGbt, &token_gbt);
        s.set(&DataKey::TokenPgbt, &token_pgbt);
        s.set(&DataKey::TokenEpt, &token_ept);
        s.set(&DataKey::ProjectCount, &0u32);
        s.set(&DataKey::UnstakePenaltyBps, &unstake_penalty_bps);
    }

    pub fn create_project(
        e: Env,
        admin: Address,
        name: String,
        description: String,
        min_stake_unit_gm: i128,
        loan_amount_usd_1e7: i128,
        funding_deadline: u32,
    ) -> u32 {
        require_admin(&e, &admin);
        if min_stake_unit_gm <= 0 || loan_amount_usd_1e7 <= 0 {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }
        let count: u32 = e.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0);
        let new_id = count + 1;
        let project = ProjectData {
            id: new_id,
            name,
            description,
            min_stake_unit_gm,
            loan_amount_usd_1e7,
            target_collateral_usd_1e7: loan_amount_usd_1e7 * 2,
            total_debt_usd_1e7: 0,
            stake_units_issued: 0,
            total_raised_usd_1e7: 0,
            total_staked_gm: 0,
            status: ProjectStatus::Proposed,
            created_ledger: e.ledger().sequence(),
            funding_deadline,
            gold_price_1e7: 0,
            is_finalized: false,
        };
        e.storage().instance().set(&DataKey::Project(new_id), &project);
        e.storage().instance().set(&DataKey::ProjectCount, &new_id);
        e.events().publish((symbol_short!("proj_new"),), new_id);
        new_id
    }

    pub fn approve_project(e: Env, admin: Address, project_id: u32) {
        require_admin(&e, &admin);
        let mut project = load_project(&e, project_id);
        project.status = ProjectStatus::Active;
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("approved"),), project_id);
    }

    /// Admin moves a project through its lifecycle (InConstruction, Operational, Completed...).
    pub fn set_status(e: Env, admin: Address, project_id: u32, status: ProjectStatus) {
        require_admin(&e, &admin);
        let mut project = load_project(&e, project_id);
        if status != ProjectStatus::Proposed && status != ProjectStatus::Active {
            project.is_finalized = true;
        }
        project.status = status;
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("status"),), project_id);
    }

    /// Stake `units` stake units of GBT in a project. Price comes from the oracle.
    pub fn stake_gbt(e: Env, user: Address, project_id: u32, units: u32) {
        user.require_auth();
        if units == 0 {
            panic_with_error!(&e, ProjectVaultError::InvalidStakeAmount);
        }
        let mut project = load_project(&e, project_id);
        if project.status != ProjectStatus::Active {
            panic_with_error!(&e, ProjectVaultError::ProjectNotActive);
        }
        if project.total_raised_usd_1e7 >= project.target_collateral_usd_1e7 {
            panic_with_error!(&e, ProjectVaultError::FullyFunded);
        }

        let price = OracleClient::new(&e, &addr(&e, DataKey::Oracle)).get_price();
        let amount_gm = project.min_stake_unit_gm * (units as i128);
        let value_usd = (amount_gm * price) / 1000;
        let token_units = amount_gm * GM_TO_UNITS;

        // Lock the GBT in the vault and issue the pGBT receipt.
        TokenClient::new(&e, &addr(&e, DataKey::TokenGbt)).transfer(
            &user,
            &e.current_contract_address(),
            &token_units,
        );
        MintableClient::new(&e, &addr(&e, DataKey::TokenPgbt)).mint(&user, &token_units);

        // Each staker carries a pro-rata share of the loan: loan / target = 50% of value staked.
        let user_debt = (value_usd * project.loan_amount_usd_1e7) / project.target_collateral_usd_1e7;

        project.stake_units_issued += units;
        project.total_raised_usd_1e7 += value_usd;
        project.total_staked_gm += amount_gm;
        project.total_debt_usd_1e7 += user_debt;
        project.gold_price_1e7 = price;
        if project.total_raised_usd_1e7 >= project.target_collateral_usd_1e7 {
            project.status = ProjectStatus::Funded;
        }

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e.storage().instance().get(&key).unwrap_or(empty_participation());
        p.gbt_staked_gm += amount_gm;
        p.stake_units += units;
        p.debt_owed_usd_1e7 += user_debt;

        e.storage().instance().set(&key, &p);
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("staked"), user), (project_id, amount_gm));
    }

    /// Leave a project before it is finalized. A penalty in GBT stays in the vault.
    pub fn unstake_with_penalty(e: Env, user: Address, project_id: u32, units: u32) -> i128 {
        user.require_auth();
        let mut project = load_project(&e, project_id);
        if project.is_finalized {
            panic_with_error!(&e, ProjectVaultError::ProjectFinalized);
        }
        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::NoPosition));
        if units == 0 || p.stake_units < units {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }

        let penalty_bps: i128 = e.storage().instance().get(&DataKey::UnstakePenaltyBps).unwrap_or(500);
        let amount_gm = project.min_stake_unit_gm * (units as i128);
        let penalty_gm = (amount_gm * penalty_bps) / 10_000;

        TokenClient::new(&e, &addr(&e, DataKey::TokenPgbt)).burn(&user, &(amount_gm * GM_TO_UNITS));
        TokenClient::new(&e, &addr(&e, DataKey::TokenGbt)).transfer(
            &e.current_contract_address(),
            &user,
            &((amount_gm - penalty_gm) * GM_TO_UNITS),
        );

        let debt_released = (p.debt_owed_usd_1e7 * units as i128) / p.stake_units as i128;
        let value_released = (project.total_raised_usd_1e7 * amount_gm) / project.total_staked_gm;
        p.gbt_staked_gm -= amount_gm;
        p.stake_units -= units;
        p.debt_owed_usd_1e7 -= debt_released;
        project.stake_units_issued -= units;
        project.total_staked_gm -= amount_gm;
        project.total_raised_usd_1e7 -= value_released;
        project.total_debt_usd_1e7 -= debt_released;

        e.storage().instance().set(&key, &p);
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("unstaked"), user), (project_id, units, penalty_gm));
        penalty_gm
    }

    pub fn prepay_debt(e: Env, user: Address, project_id: u32, amount_usd_1e7: i128) {
        user.require_auth();
        if amount_usd_1e7 <= 0 {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }
        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::NoPosition));
        let remaining = p.debt_owed_usd_1e7 - p.debt_paid_usd_1e7;
        let payment = if amount_usd_1e7 > remaining { remaining } else { amount_usd_1e7 };
        p.debt_paid_usd_1e7 += payment;
        e.storage().instance().set(&key, &p);
        e.events().publish((symbol_short!("prepaid"), user), (project_id, payment));
    }

    /// Debt repaid + KYC verified: the staker recovers the GBT and receives ePT.
    pub fn claim_ept(e: Env, user: Address, project_id: u32) -> i128 {
        user.require_auth();
        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::NoPosition));
        if p.debt_paid_usd_1e7 < p.debt_owed_usd_1e7 {
            panic_with_error!(&e, ProjectVaultError::DebtNotFullyPaid);
        }
        if !p.kyc_verified {
            panic_with_error!(&e, ProjectVaultError::KycNotVerified);
        }
        if p.ept_claimed {
            panic_with_error!(&e, ProjectVaultError::EptAlreadyClaimed);
        }
        let token_units = p.gbt_staked_gm * GM_TO_UNITS;
        TokenClient::new(&e, &addr(&e, DataKey::TokenPgbt)).burn(&user, &token_units);
        TokenClient::new(&e, &addr(&e, DataKey::TokenGbt)).transfer(
            &e.current_contract_address(),
            &user,
            &token_units,
        );
        MintableClient::new(&e, &addr(&e, DataKey::TokenEpt)).mint(&user, &token_units);

        p.ept_claimed = true;
        p.ept_balance = p.gbt_staked_gm;
        e.storage().instance().set(&key, &p);
        e.events().publish((symbol_short!("ept_claim"), user), (project_id, p.gbt_staked_gm));
        p.gbt_staked_gm
    }

    pub fn set_kyc_verified(e: Env, admin: Address, user: Address, project_id: u32, verified: bool) {
        require_admin(&e, &admin);
        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::NoPosition));
        p.kyc_verified = verified;
        e.storage().instance().set(&key, &p);
        e.events().publish((symbol_short!("kyc_set"), user), (project_id, verified));
    }

    /// Book project profits (USD, 1e7). They are applied pro-rata per stake unit.
    pub fn add_profit(e: Env, admin: Address, project_id: u32, amount_usd_1e7: i128) {
        require_admin(&e, &admin);
        if amount_usd_1e7 <= 0 {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }
        let current: i128 = e.storage().instance().get(&DataKey::ProjectProfit(project_id)).unwrap_or(0);
        e.storage().instance().set(&DataKey::ProjectProfit(project_id), &(current + amount_usd_1e7));
        e.events().publish((symbol_short!("profit"),), (project_id, amount_usd_1e7));
    }

    /// Apply the staker's share of booked profits: debt first, the rest is claimable.
    pub fn claim_profits(e: Env, user: Address, project_id: u32) -> i128 {
        user.require_auth();
        let key = DataKey::UserProject(user.clone(), project_id);
        let mut p: UserParticipation = e
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::NoPosition));
        let total_profit: i128 = e.storage().instance().get(&DataKey::ProjectProfit(project_id)).unwrap_or(0);
        if total_profit <= 0 {
            panic_with_error!(&e, ProjectVaultError::NoProfit);
        }
        let project = load_project(&e, project_id);
        if project.stake_units_issued == 0 {
            panic_with_error!(&e, ProjectVaultError::NoProfit);
        }
        let user_profit = (total_profit * p.stake_units as i128) / project.stake_units_issued as i128;
        let claimable = user_profit - p.profits_claimed;
        if claimable <= 0 {
            return 0;
        }
        let remaining_debt = p.debt_owed_usd_1e7 - p.debt_paid_usd_1e7;
        let debt_payment = if claimable >= remaining_debt { remaining_debt } else { claimable };
        let to_user = claimable - debt_payment;
        p.debt_paid_usd_1e7 += debt_payment;
        p.profits_claimed += claimable;
        e.storage().instance().set(&key, &p);
        e.events().publish((symbol_short!("claimed"), user), (project_id, to_user));
        to_user
    }

    pub fn finalize_project(e: Env, admin: Address, project_id: u32) {
        require_admin(&e, &admin);
        let mut project = load_project(&e, project_id);
        project.is_finalized = true;
        project.status = ProjectStatus::Funded;
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("finalized"),), project_id);
    }

    // ---------- Views ----------

    pub fn project_count(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0)
    }

    pub fn get_project(e: Env, project_id: u32) -> ProjectData {
        load_project(&e, project_id)
    }

    pub fn get_participation(e: Env, user: Address, project_id: u32) -> UserParticipation {
        e.storage()
            .instance()
            .get(&DataKey::UserProject(user, project_id))
            .unwrap_or(empty_participation())
    }

    pub fn get_profit(e: Env, project_id: u32) -> i128 {
        e.storage().instance().get(&DataKey::ProjectProfit(project_id)).unwrap_or(0)
    }
}
