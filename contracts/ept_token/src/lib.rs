#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
    token::Interface as TokenInterface,
};

// Environmental Project Token — minimal SEP-41 token. Balances use 7 decimals (1 gram = 10_000_000 units).
// Only the admin (the protocol contract that controls issuance) can mint.

#[contracttype]
enum Key {
    Admin,
    Supply,
    Bal(Address),
    Allow(Address, Address),
}

fn bal(e: &Env, id: &Address) -> i128 {
    e.storage().instance().get(&Key::Bal(id.clone())).unwrap_or(0)
}
fn set_bal(e: &Env, id: &Address, v: i128) {
    e.storage().instance().set(&Key::Bal(id.clone()), &v);
}
fn supply(e: &Env) -> i128 {
    e.storage().instance().get(&Key::Supply).unwrap_or(0)
}
fn move_funds(e: &Env, from: &Address, to: &Address, amount: i128) {
    if amount < 0 { panic!("negative amount"); }
    let fb = bal(e, from);
    if fb < amount { panic!("insufficient balance"); }
    set_bal(e, from, fb - amount);
    set_bal(e, to, bal(e, to) + amount);
}
fn spend_allowance(e: &Env, from: &Address, spender: &Address, amount: i128) {
    let k = Key::Allow(from.clone(), spender.clone());
    let a: i128 = e.storage().instance().get(&k).unwrap_or(0);
    if a < amount { panic!("insufficient allowance"); }
    e.storage().instance().set(&k, &(a - amount));
}

#[contract]
pub struct Token;

#[contractimpl]
impl TokenInterface for Token {
    fn allowance(e: Env, from: Address, spender: Address) -> i128 {
        e.storage().instance().get(&Key::Allow(from, spender)).unwrap_or(0)
    }
    fn approve(e: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 { panic!("negative amount"); }
        e.storage().instance().set(&Key::Allow(from, spender), &amount);
    }
    fn balance(e: Env, id: Address) -> i128 { bal(&e, &id) }
    fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        move_funds(&e, &from, &to, amount);
        e.events().publish((symbol_short!("transfer"), from, to), amount);
    }
    fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        spend_allowance(&e, &from, &spender, amount);
        move_funds(&e, &from, &to, amount);
        e.events().publish((symbol_short!("transfer"), from, to), amount);
    }
    fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount < 0 { panic!("negative amount"); }
        let b = bal(&e, &from);
        if b < amount { panic!("insufficient balance"); }
        set_bal(&e, &from, b - amount);
        e.storage().instance().set(&Key::Supply, &(supply(&e) - amount));
        e.events().publish((symbol_short!("burn"), from), amount);
    }
    fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        spend_allowance(&e, &from, &spender, amount);
        let b = bal(&e, &from);
        if b < amount { panic!("insufficient balance"); }
        set_bal(&e, &from, b - amount);
        e.storage().instance().set(&Key::Supply, &(supply(&e) - amount));
        e.events().publish((symbol_short!("burn"), from), amount);
    }
    fn decimals(_e: Env) -> u32 { 7 }
    fn name(e: Env) -> String { String::from_str(&e, "Environmental Project Token") }
    fn symbol(e: Env) -> String { String::from_str(&e, "ePT") }
}

#[contractimpl]
impl Token {
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&Key::Admin) { return; }
        e.storage().instance().set(&Key::Admin, &admin);
    }
    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&Key::Admin).unwrap()
    }
    pub fn total_supply(e: Env) -> i128 { supply(&e) }
    pub fn mint(e: Env, to: Address, amount: i128) {
        let admin: Address = e.storage().instance().get(&Key::Admin).unwrap();
        admin.require_auth();
        if amount < 0 { panic!("negative amount"); }
        set_bal(&e, &to, bal(&e, &to) + amount);
        e.storage().instance().set(&Key::Supply, &(supply(&e) + amount));
        e.events().publish((symbol_short!("mint"), to), amount);
    }
}
