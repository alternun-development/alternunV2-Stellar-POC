#![no_std]
use soroban_sdk::{
    contract, contractimpl, Address, Env, String, Symbol,
    token::Interface as TokenInterface,
    symbol_short,
};

#[contract]
pub struct PgbtToken;

#[contractimpl]
impl TokenInterface for PgbtToken {
    fn allowance(e: Env, from: Address, spender: Address) -> i128 {
        e.storage().instance().get(&(from, spender)).unwrap_or(0)
    }

    fn approve(e: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        e.storage().instance().set(&(from, spender), &amount);
    }

    fn balance(e: Env, id: Address) -> i128 {
        e.storage().instance().get(&id).unwrap_or(0)
    }

    fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_balance = Self::balance(e.clone(), from.clone());
        let to_balance = Self::balance(e.clone(), to.clone());
        
        e.storage().instance().set(&from, &(from_balance - amount));
        e.storage().instance().set(&to, &(to_balance + amount));
    }

    fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let allowance = Self::allowance(e.clone(), from.clone(), spender.clone());
        
        Self::transfer(e.clone(), from.clone(), to, amount);
        
        e.storage().instance().set(&(from, spender), &(allowance - amount));
    }

    fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        let balance = Self::balance(e.clone(), from.clone());
        e.storage().instance().set(&from, &(balance - amount));
    }

    fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let allowance = Self::allowance(e.clone(), from.clone(), spender.clone());
        
        Self::burn(e.clone(), from.clone(), amount);
        
        e.storage().instance().set(&(from, spender), &(allowance - amount));
    }

    fn decimals(_e: Env) -> u32 {
        7 // Same as GBT - 7 decimals
    }

    fn name(e: Env) -> String {
        String::from_str(&e, "Project GBT")
    }

    fn symbol(e: Env) -> String {
        String::from_str(&e, "pGBT")
    }
}

#[contractimpl]
impl PgbtToken {
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&symbol_short!("admin")) {
            return;
        }
        e.storage().instance().set(&symbol_short!("admin"), &admin);
    }

    pub fn mint(e: Env, to: Address, amount: i128) {
        let admin: Address = e.storage().instance().get(&symbol_short!("admin")).unwrap();
        admin.require_auth();
        
        let balance = Self::balance(e.clone(), to.clone());
        e.storage().instance().set(&to, &(balance + amount));
    }
}
