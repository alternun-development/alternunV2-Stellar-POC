#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String,
    token::Client as TokenClient, Symbol, symbol_short,
    panic_with_error, contracterror,
};

// Project status enum
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum ProjectStatus {
    Proposed,    // Waiting for DAO approval
    Active,      // Approved and accepting deposits
    Funded,      // Target reached, project executing  
    Completed,   // Project finished, profits distributing
    Cancelled,   // Project cancelled, funds returned
}

// Project data structure
#[contracttype]
#[derive(Clone)]
pub struct ProjectData {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub target_gbt_gm: i128,        // Target GBT amount in grams * 1000
    pub raised_gbt_gm: i128,        // Current raised amount
    pub status: ProjectStatus,
    pub admin: Address,             // Project administrator
    pub created_ledger: u32,
    pub funding_deadline: u32,      // Ledger number deadline
}

// User participation in a project
#[contracttype]
#[derive(Clone)]
pub struct UserParticipation {
    pub gbt_staked_gm: i128,       // GBT staked in grams * 1000
    pub pgbt_balance: i128,        // pGBT tokens received
    pub ept_balance: i128,         // ePT tokens (after conversion)
    pub profits_claimed: i128,     // Profits already claimed
    pub last_claim_ledger: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenGbt,           // GBT token address
    TokenPgbt,          // pGBT token address (project participation)
    TokenEpt,           // ePT token address (equity participation)
    ProjectCount,       // Total number of projects
    Project(u32),       // Project data by ID
    UserProject(Address, u32), // User participation in project
    ProjectProfit(u32), // Total profits for project
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ProjectVaultError {
    NotAdmin = 1,
    ProjectNotFound = 2,
    ProjectNotActive = 3,
    InsufficientStake = 4,
    AlreadyConverted = 5,
    NoProfit = 6,
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
        token_ept: Address
    ) {
        if e.storage().instance().has(&DataKey::Admin) { return; }
        admin.require_auth();
        
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::TokenGbt, &token_gbt);
        e.storage().instance().set(&DataKey::TokenPgbt, &token_pgbt);
        e.storage().instance().set(&DataKey::TokenEpt, &token_ept);
        e.storage().instance().set(&DataKey::ProjectCount, &0u32);
    }

    // Admin function: Create new project proposal
    pub fn create_project(
        e: Env,
        admin: Address,
        name: String,
        description: String,
        target_gbt_gm: i128,
        funding_deadline: u32,
    ) -> u32 {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let project_count: u32 = e.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0);
        let project_id = project_count + 1;

        let project = ProjectData {
            id: project_id,
            name,
            description,
            target_gbt_gm,
            raised_gbt_gm: 0,
            status: ProjectStatus::Proposed,
            admin: admin.clone(),
            created_ledger: e.ledger().sequence(),
            funding_deadline,
        };

        e.storage().instance().set(&DataKey::Project(project_id), &project);
        e.storage().instance().set(&DataKey::ProjectCount, &project_id);

        project_id
    }

    // Admin function: Approve project (DAO would call this)
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
    }

    // User function: Stake GBT in a project to receive pGBT
    pub fn stake_in_project(
        e: Env,
        user: Address,
        project_id: u32,
        gbt_amount_gm: i128,
    ) {
        user.require_auth();

        let project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        if project.status != ProjectStatus::Active {
            panic_with_error!(&e, ProjectVaultError::ProjectNotActive);
        }

        if e.ledger().sequence() > project.funding_deadline {
            panic_with_error!(&e, ProjectVaultError::ProjectNotActive);
        }

        // Transfer GBT from user to this contract
        let gbt_token: Address = e.storage().instance().get(&DataKey::TokenGbt).unwrap();
        let gbt_client = TokenClient::new(&e, &gbt_token);
        let gbt_units = gbt_amount_gm * 10_000; // Convert grams*1000 to token units (7 decimals)
        gbt_client.transfer(&user, &e.current_contract_address(), &gbt_units);

        // Update user participation
        let participation_key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&participation_key)
            .unwrap_or(UserParticipation {
                gbt_staked_gm: 0,
                pgbt_balance: gbt_amount_gm, // 1:1 ratio initially
                ept_balance: 0,
                profits_claimed: 0,
                last_claim_ledger: 0,
            });

        participation.gbt_staked_gm += gbt_amount_gm;
        participation.pgbt_balance += gbt_amount_gm;
        e.storage().instance().set(&participation_key, &participation);

        // Update project raised amount
        let mut updated_project = project;
        updated_project.raised_gbt_gm += gbt_amount_gm;
        
        // Check if project reached target
        if updated_project.raised_gbt_gm >= updated_project.target_gbt_gm {
            updated_project.status = ProjectStatus::Funded;
        }
        
        e.storage().instance().set(&DataKey::Project(project_id), &updated_project);

        // Mint pGBT tokens to user (project-specific participation tokens)
        let pgbt_token: Address = e.storage().instance().get(&DataKey::TokenPgbt).unwrap();
        let pgbt_client = TokenClient::new(&e, &pgbt_token);
        let pgbt_units = gbt_amount_gm * 10_000; // Same units as GBT
        pgbt_client.transfer(&e.current_contract_address(), &user, &pgbt_units);
    }

    // User function: Convert pGBT to ePT (after 50% value repayment)
    pub fn convert_to_equity(e: Env, user: Address, project_id: u32, pgbt_amount_gm: i128) {
        user.require_auth();

        let participation_key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&participation_key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::InsufficientStake));

        if participation.pgbt_balance < pgbt_amount_gm {
            panic_with_error!(&e, ProjectVaultError::InsufficientStake);
        }

        // In production: Check if user has repaid 50% of locked value
        // For POC: Allow conversion directly
        
        // Burn pGBT and mint ePT
        participation.pgbt_balance -= pgbt_amount_gm;
        participation.ept_balance += pgbt_amount_gm; // 1:1 conversion for POC
        e.storage().instance().set(&participation_key, &participation);

        // Transfer tokens
        let pgbt_token: Address = e.storage().instance().get(&DataKey::TokenPgbt).unwrap();
        let ept_token: Address = e.storage().instance().get(&DataKey::TokenEpt).unwrap();
        let pgbt_client = TokenClient::new(&e, &pgbt_token);
        let ept_client = TokenClient::new(&e, &ept_token);
        
        let token_units = pgbt_amount_gm * 10_000;
        pgbt_client.transfer(&user, &e.current_contract_address(), &token_units);
        ept_client.transfer(&e.current_contract_address(), &user, &token_units);
    }

    // Admin function: Add profits to project (from completed projects)
    pub fn add_project_profits(e: Env, admin: Address, project_id: u32, profit_amount: i128) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, ProjectVaultError::NotAdmin);
        }
        admin.require_auth();

        let current_profits: i128 = e.storage().instance()
            .get(&DataKey::ProjectProfit(project_id))
            .unwrap_or(0);
        
        e.storage().instance().set(&DataKey::ProjectProfit(project_id), &(current_profits + profit_amount));
    }

    // View functions
    pub fn get_project(e: Env, project_id: u32) -> ProjectData {
        e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound))
    }

    pub fn get_project_count(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0)
    }

    pub fn get_user_participation(e: Env, user: Address, project_id: u32) -> UserParticipation {
        e.storage().instance()
            .get(&DataKey::UserProject(user, project_id))
            .unwrap_or(UserParticipation {
                gbt_staked_gm: 0,
                pgbt_balance: 0,
                ept_balance: 0,
                profits_claimed: 0,
                last_claim_ledger: 0,
            })
    }

    pub fn get_project_profits(e: Env, project_id: u32) -> i128 {
        e.storage().instance().get(&DataKey::ProjectProfit(project_id)).unwrap_or(0)
    }

    pub fn claim_profits(e: Env, user: Address, project_id: u32) -> i128 {
        user.require_auth();

        let participation_key = DataKey::UserProject(user.clone(), project_id);
        let mut participation: UserParticipation = e.storage().instance()
            .get(&participation_key)
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::InsufficientStake));

        let total_profits: i128 = e.storage().instance()
            .get(&DataKey::ProjectProfit(project_id))
            .unwrap_or(0);

        if total_profits == 0 {
            panic_with_error!(&e, ProjectVaultError::NoProfit);
        }

        // Calculate user share based on participation
        let project: ProjectData = e.storage().instance()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&e, ProjectVaultError::ProjectNotFound));

        // User share = (user_stake / total_raised) * total_profits * 80% (20% goes to Alternun)
        let user_total_tokens = participation.pgbt_balance + participation.ept_balance;
        let user_share = if project.raised_gbt_gm > 0 {
            (user_total_tokens * total_profits * 80) / (project.raised_gbt_gm * 100)
        } else {
            0
        };

        let claimable = user_share - participation.profits_claimed;
        
        if claimable > 0 {
            participation.profits_claimed += claimable;
            participation.last_claim_ledger = e.ledger().sequence();
            e.storage().instance().set(&participation_key, &participation);
        }

        claimable
    }
}

