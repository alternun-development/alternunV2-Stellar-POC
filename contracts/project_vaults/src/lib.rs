#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String,
    token::Client as TokenClient, symbol_short,
    panic_with_error, contracterror,
};

#[contracttype]
#[derive(Clone, PartialEq)]
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
    pub min_stake_unit_gm: i128,    // Minimum stake unit (e.g., 5000 = 5 grams)
    pub loan_amount_usd_1e7: i128,
    pub total_debt_usd_1e7: i128,
    pub stake_units_issued: u32,
    pub total_raised_usd_1e7: i128,
    pub status: ProjectStatus,
    pub admin: Address,
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
    DebtRatioTooHigh = 8,
    EptAlreadyClaimed = 9,
    KycNotVerified = 10,
    ProjectNotFinalized = 11,
}

#[contract]
pub struct ProjectVaults;

#[contractimpl]
impl ProjectVaults {
    pub fn init(
        e: Env,
        admin: Address,
        token_gbt: Address,
        token_pgbt: Address,
        token_ept: Address,
        unstake_penalty_bps: i128,
    ) {
        if e.storage().instance().has(&DataKey::Admin) { return; }
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::TokenGbt, &token_gbt);
        e.storage().instance().set(&DataKey::TokenPgbt, &token_pgbt);
        e.storage().instance().set(&DataKey::TokenEpt, &token_ept);
        e.storage().instance().set(&DataKey::ProjectCount, &0u32);
        e.storage().instance().set(&DataKey::UnstakePenaltyBps, &unstake_penalty_bps);
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
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let count: u32 = e.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0);
        let new_id = count + 1;

        let project = ProjectData {
            id: new_id,
            name,
            description,
            min_stake_unit_gm,
            loan_amount_usd_1e7,
            total_debt_usd_1e7: 0,
            stake_units_issued: 0,
            total_raised_usd_1e7: 0,
            status: ProjectStatus::Proposed,
            admin: admin.clone(),
            created_ledger: e.ledger().sequence(),
            funding_deadline,
            gold_price_1e7: 0,
            is_finalized: false,
        };

        e.storage().instance().set(&DataKey::Project(new_id), &project);
        e.storage().instance().set(&DataKey::ProjectCount, &new_id);
        e.events().publish((symbol_short!("proj_new"),), (new_id,));
        new_id
    }

    pub fn approve_project(e: Env, admin: Address, project_id: u32) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let mut project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        project.status = ProjectStatus::Active;
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("approved"),), (project_id,));
    }

    pub fn stake_gbt(
        e: Env,
        user: Address,
        project_id: u32,
        gold_price_1e7: i128,
    ) {
        user.require_auth();

        let mut project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if project.status != ProjectStatus::Active {
            panic_with_error!(&e, ProjectVaultError::ProjectNotActive);
        }

        let amount_gm = project.min_stake_unit_gm;

        if project.gold_price_1e7 == 0 {
            project.gold_price_1e7 = gold_price_1e7;
        }

        let unit_value_usd = (amount_gm * gold_price_1e7) / 1000;
        let new_total_raised = project.total_raised_usd_1e7 + unit_value_usd;

        let debt_ratio = (project.loan_amount_usd_1e7 * 100) / new_total_raised;
        if debt_ratio > 50 {
            panic_with_error!(&e, ProjectVaultError::DebtRatioTooHigh);
        }

        let gbt_token: Address = e.storage().instance().get(&DataKey::TokenGbt).unwrap();
        let gbt = TokenClient::new(&e, &gbt_token);
        gbt.transfer(&user, &e.current_contract_address(), &amount_gm);

        let user_debt = (project.loan_amount_usd_1e7 * unit_value_usd) / new_total_raised;

        project.stake_units_issued += 1;
        project.total_raised_usd_1e7 = new_total_raised;
        project.total_debt_usd_1e7 += user_debt;

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or(UserParticipation {
                gbt_staked_gm: 0,
                stake_units: 0,
                debt_owed_usd_1e7: 0,
                debt_paid_usd_1e7: 0,
                ept_claimed: false,
                ept_balance: 0,
                profits_claimed: 0,
                kyc_verified: false,
            });

        participation.gbt_staked_gm += amount_gm;
        participation.stake_units += 1;
        participation.debt_owed_usd_1e7 += user_debt;

        e.storage().instance().set(&key, &participation);
        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.events().publish((symbol_short!("staked"),), (user, project_id, amount_gm));
    }

    pub fn unstake_with_penalty(
        e: Env,
        user: Address,
        project_id: u32,
        units: u32,
    ) -> i128 {
        user.require_auth();

        let project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if project.is_finalized {
            panic_with_error!(&e, ProjectVaultError::ProjectNotFinalized);
        }

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if participation.stake_units < units {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }

        let penalty_bps: i128 = e.storage().instance().get(&DataKey::UnstakePenaltyBps).unwrap_or(500);
        let amount_gm = project.min_stake_unit_gm * (units as i128);
        let penalty = (amount_gm * penalty_bps) / 10000;
        let amount_after_penalty = amount_gm - penalty;

        let gbt_token: Address = e.storage().instance().get(&DataKey::TokenGbt).unwrap();
        let gbt = TokenClient::new(&e, &gbt_token);
        gbt.transfer(&e.current_contract_address(), &user, &amount_after_penalty);

        participation.gbt_staked_gm -= amount_gm;
        participation.stake_units -= units;

        e.storage().instance().set(&key, &participation);
        e.events().publish((symbol_short!("unstaked"),), (user, project_id, units, penalty));

        penalty
    }

    pub fn prepay_debt(
        e: Env,
        user: Address,
        project_id: u32,
        amount_usd_1e7: i128,
    ) {
        user.require_auth();

        if amount_usd_1e7 <= 0 {
            panic_with_error!(&e, ProjectVaultError::InvalidAmount);
        }

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        let remaining_debt = participation.debt_owed_usd_1e7 - participation.debt_paid_usd_1e7;
        let payment = if amount_usd_1e7 > remaining_debt {
            remaining_debt
        } else {
            amount_usd_1e7
        };

        participation.debt_paid_usd_1e7 += payment;
        e.storage().instance().set(&key, &participation);

        e.events().publish((symbol_short!("prepaid"),), (user, project_id, payment));
    }

    pub fn claim_ept(
        e: Env,
        user: Address,
        project_id: u32,
    ) -> i128 {
        user.require_auth();

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if participation.debt_paid_usd_1e7 < participation.debt_owed_usd_1e7 {
            panic_with_error!(&e, ProjectVaultError::DebtNotFullyPaid);
        }

        if !participation.kyc_verified {
            panic_with_error!(&e, ProjectVaultError::KycNotVerified);
        }

        if participation.ept_claimed {
            panic_with_error!(&e, ProjectVaultError::EptAlreadyClaimed);
        }

        let project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap();

        let amount = participation.gbt_staked_gm;

        let gbt_token: Address = e.storage().instance().get(&DataKey::TokenGbt).unwrap();
        let gbt = TokenClient::new(&e, &gbt_token);
        gbt.transfer(&e.current_contract_address(), &user, &amount);

        participation.ept_claimed = true;
        participation.ept_balance = amount;
        e.storage().instance().set(&key, &participation);

        e.events().publish((symbol_short!("ept_claim"),), (user.clone(), project_id, amount));
        amount
    }

    pub fn set_kyc_verified(
        e: Env,
        admin: Address,
        user: Address,
        project_id: u32,
        verified: bool,
    ) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        participation.kyc_verified = verified;
        e.storage().instance().set(&key, &participation);

        e.events().publish((symbol_short!("kyc_set"),), (user, project_id, verified));
    }

    pub fn claim_profits(e: Env, user: Address, project_id: u32) -> i128 {
        user.require_auth();

        let key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if !participation.ept_claimed {
            panic_with_error!(&e, ProjectVaultError::EptAlreadyClaimed);
        }

        let total_profit: i128 = e.storage().instance()
            .get(&DataKey::ProjectProfit(project_id))
            .unwrap_or(0);

        if total_profit <= 0 {
            panic_with_error!(&e, ProjectVaultError::NoProfit);
        }

        let project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap();

        let user_share = participation.stake_units as i128;
        let total_units = project.stake_units_issued as i128;

        let user_profit = (total_profit * user_share) / total_units;
        let claimable = user_profit - participation.profits_claimed;

        if claimable <= 0 {
            return 0;
        }

        let remaining_debt = participation.debt_owed_usd_1e7 - participation.debt_paid_usd_1e7;
        
        let (debt_payment, actual_claim) = if remaining_debt > 0 {
            if claimable >= remaining_debt {
                (remaining_debt, claimable - remaining_debt)
            } else {
                (claimable, 0)
            }
        } else {
            (0, claimable)
        };

        participation.debt_paid_usd_1e7 += debt_payment;
        participation.profits_claimed += claimable;
        e.storage().instance().set(&key, &participation);

        e.events().publish((symbol_short!("claimed"),), (user, project_id, actual_claim));
        actual_claim
    }

    pub fn finalize_project(e: Env, admin: Address, project_id: u32) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let mut project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        project.is_finalized = true;
        project.status = ProjectStatus::Funded;
        e.storage().instance().set(&DataKey::Project(project_id), &project);

        e.events().publish((symbol_short!("finalized"),), (project_id,));
    }

    pub fn get_participation(e: Env, user: Address, project_id: u32) -> UserParticipation {
        let key = DataKey::UserProject(user, project_id);
        e.storage().instance()
            .get(&key)
            .unwrap_or(UserParticipation {
                gbt_staked_gm: 0,
                stake_units: 0,
                debt_owed_usd_1e7: 0,
                debt_paid_usd_1e7: 0,
                ept_claimed: false,
                ept_balance: 0,
                profits_claimed: 0,
                kyc_verified: false,
            })
    }

    pub fn get_project(e: Env, project_id: u32) -> ProjectData {
        e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound))
    }

    pub fn add_profit(e: Env, admin: Address, project_id: u32, amount_usd_1e7: i128) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let current: i128 = e.storage().instance()
            .get(&DataKey::ProjectProfit(project_id))
            .unwrap_or(0);
        
        e.storage().instance().set(&DataKey::ProjectProfit(project_id), &(current + amount_usd_1e7));
        e.events().publish((symbol_short!("profit"),), (project_id, amount_usd_1e7));
    }
}
