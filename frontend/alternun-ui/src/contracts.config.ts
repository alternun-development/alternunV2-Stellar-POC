export const TESTNET_CONTRACTS = {
  // Core contracts
  ORACLE_MOCK: "CDDQAXBHX6DZGNPD4NFACI3AUTQHFYDW5GND7IZKU4AYKA2S2CKZVU7O",
  TREASURY: "CBRZ6ZOXCHSFDRHVN6ME2VJGPRUZU3MPV25HUAGFJQKPPEJC6ADML6U2",
  GBT_TOKEN: "CAYWLYDDHELX26HHULPJHMIX4AZMCY7SZ6GDIP2PBNRJW6SOILVKLN53",
  GBT_MINTER: "CDQIGRMWCC7UPL4WWU3FSFGC27QHZP57SGPQSCISENL4NJ6ZRALG5DPJ",
  
  // Project contracts
  PROJECT_VAULTS: "CACTM455WBZ3CW7HYGAA4XMIBRAXQLKW5I7C4E4Q47ITD552G3SX6SHD",
  PGBT_TOKEN: "CCEHPRCCXPCX7WK5NZ4QE2SIOKV4ALGVWKGBWGH2SZ5E7JEL55GFZ3D3",
  EPT_TOKEN: "CD4BCD2TZN4GPU4RBKRJITMBGSP7BKG6K2EITVFDDR4RM7KIOQY3ZW2C",
};

export const TESTNET_CONFIG = {
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  RPC_URL: "https://soroban-testnet.stellar.org",
  USDC_ADDRESS: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
};

export const MINE_DATA = {
  AL1: {
    id: 1,
    name: "AL-1 Mine",
    inferidos_gm: 435400000, // 435,400 grams
    capacity_gm: 52248000,   // 52.248 grams mintable
  }
};



export const APP_WALLET = {
  PUBLIC_KEY: "GCAG7IPYMSYSK7Q4G3F42W5WMXAOMMQ4Y7ERA64DT57TYPDKGUY35QS6",
  // Note: Private key should never be in frontend code in production
  // This is only for POC/demo purposes
};


export const SOLAR_PROJECT = {
  name: "Rionegro Solar Farm",
  location: "Rionegro, Santander (Zona AL-1)",
  area_hectares: 2,
  panels: 6000,
  panel_capacity_kw: 0.4, // 400W por panel típico
  total_capacity_mw: 2.4, // 6000 * 400W = 2.4 MW
  annual_production_mwh: 3456, // 2.4 MW * 1440 horas sol/año
  homes_powered: 1152, // ~3 MWh/año por hogar
  co2_offset_tons: 1728, // ~0.5 tons CO2/MWh
  target_funding_gbt: 36923, // ~$24,000 / $0.65 per gram
};
