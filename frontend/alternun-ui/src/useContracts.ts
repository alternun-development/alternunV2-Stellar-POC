import { useState } from "react";
import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { TESTNET_CONTRACTS, TESTNET_CONFIG, APP_WALLET, MINE_DATA } from "./contracts.config";

const server = new SorobanRpc.Server(TESTNET_CONFIG.RPC_URL);

// Use the funded account for simulations
const SIMULATION_ACCOUNT = APP_WALLET.PUBLIC_KEY;

export function useContracts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get gold price from oracle
  const getGoldPrice = async (): Promise<number | null> => {
    try {
      console.log("?? Fetching gold price from oracle...");
      setLoading(true);
      setError(null);

      const contract = new Contract(TESTNET_CONTRACTS.ORACLE_MOCK);
      console.log("?? Oracle contract:", TESTNET_CONTRACTS.ORACLE_MOCK);
      
      const account = await server.getAccount(SIMULATION_ACCOUNT);
      console.log("? Got simulation account");
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("get_price"))
        .setTimeout(30)
        .build();

      console.log("?? Simulating transaction...");
      const response = await server.simulateTransaction(transaction);
      console.log("?? Full response:", response);
      
      if (SorobanRpc.Api.isSimulationSuccess(response)) {
        console.log("? Simulation successful");
        const resultValue = response.result?.retval;
        console.log("?? Result retval:", resultValue);
        
        if (resultValue) {
          // Convert XDR ScVal to native JavaScript value
          const priceScaled = scValToNative(resultValue);
          console.log("?? Parsed value:", priceScaled, "type:", typeof priceScaled);
          
          // Convert from 1e7 scale to regular USD
          const priceUsd = Number(priceScaled) / 10000000;
          console.log("?? Gold price in USD:", priceUsd);
          
          setLoading(false);
          return priceUsd;
        }
      } else {
        console.error("? Simulation failed:", response);
      }
      
      setLoading(false);
      return null;
    } catch (err: any) {
      console.error("? Error getting gold price:", err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  };

  // Get mine capacity
  const getMineCapacity = async (mineId: number): Promise<number | null> => {
    try {
      console.log("?? Fetching mine capacity for mine:", mineId);
      setLoading(true);
      setError(null);

      const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
      
      const account = await server.getAccount(SIMULATION_ACCOUNT);
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "available_capacity_gm",
            nativeToScVal(mineId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      console.log("?? Simulating mine_capacity_gm...");
      const response = await server.simulateTransaction(transaction);
      console.log("?? Capacity response:", response);
      
      if (SorobanRpc.Api.isSimulationSuccess(response)) {
        const resultValue = response.result?.retval;
        console.log("?? Capacity result:", resultValue);
        
        if (resultValue) {
          const capacity = scValToNative(resultValue);
          console.log("?? Mine capacity:", capacity);
          setLoading(false);
          return Number(capacity);
        }
      } else {
        console.error("? Capacity simulation failed:", response);
      }
      
      setLoading(false);
      return null;
    } catch (err: any) {
      console.error("? Error getting mine capacity:", err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  };


  // Get total minted amount
  const getTotalMinted = async (): Promise<number | null> => {
    try {
      console.log("?? Fetching total minted...");
      setLoading(true);
      
      const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
      const account = await server.getAccount(SIMULATION_ACCOUNT);
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("available_capacity_gm", nativeToScVal(1, { type: "u32" })))
        .setTimeout(30)
        .build();

      const response = await server.simulateTransaction(transaction);
      
      if (SorobanRpc.Api.isSimulationSuccess(response)) {
        const resultValue = response.result?.retval;
        if (resultValue) {
          const available = scValToNative(resultValue);
          // Total capacity - available = minted
          const totalCapacity = MINE_DATA.AL1.capacity_gm / 1000;
          const availableGrams = Number(available) / 1000;
          const minted = totalCapacity - availableGrams;
          setLoading(false);
          return minted;
        }
      }
      
      setLoading(false);
      return null;
    } catch (err: any) {
      console.error("? Error getting minted:", err);
      setLoading(false);
      return null;
    }
  };

  // Get mine data
  const getMineData = async (mineId: number): Promise<any | null> => {
    try {
      console.log("?? Fetching mine data for mine:", mineId);
      setLoading(true);
      
      const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
      const account = await server.getAccount(SIMULATION_ACCOUNT);
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("get_mine", nativeToScVal(mineId, { type: "u32" })))
        .setTimeout(30)
        .build();

      const response = await server.simulateTransaction(transaction);
      
      if (SorobanRpc.Api.isSimulationSuccess(response)) {
        const resultValue = response.result?.retval;
        if (resultValue) {
          const mineData = scValToNative(resultValue);
          setLoading(false);
          return mineData;
        }
      }
      
      setLoading(false);
      return null;
    } catch (err: any) {
      console.error("? Error getting mine data:", err);
      setLoading(false);
      return null;
    }
  };


  // Get total number of registered mines (checking up to maxId)
  const getActiveMinesCount = async (maxCheckId: number = 100): Promise<number> => {
    let activeMines = 0;
    
    for (let i = 1; i <= maxCheckId; i++) {
      try {
        const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
        const account = await server.getAccount(SIMULATION_ACCOUNT);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(contract.call("get_mine", nativeToScVal(i, { type: "u32" })))
          .setTimeout(30)
          .build();

        const response = await server.simulateTransaction(transaction);
        
        if (SorobanRpc.Api.isSimulationSuccess(response)) {
          const mineData = scValToNative(response.result?.retval);
          if (mineData && mineData.enabled) {
            activeMines++;
          }
        }
      } catch (err) {
        // Mine doesn't exist or error, stop checking
        break;
      }
    }
    
    return activeMines;
  };

  // Get total capacity across all mines
  const getTotalCapacityAllMines = async (maxMineId: number): Promise<number | null> => {
    try {
      console.log(`?? Fetching total capacity for mines 1-${maxMineId}...`);
      
      const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
      const account = await server.getAccount(SIMULATION_ACCOUNT);
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "available_capacity_gm",
            nativeToScVal(maxMineId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const response = await server.simulateTransaction(transaction);
      
      if (SorobanRpc.Api.isSimulationSuccess(response)) {
        const resultValue = response.result?.retval;
        if (resultValue) {
          const capacity = scValToNative(resultValue);
          return Number(capacity) / 1000; // Convert to grams
        }
      }
      
      return null;
    } catch (err: any) {
      console.error("? Error getting total capacity:", err);
      return null;
    }
  };


  // Get aggregated resources from all active mines
  const getAggregatedMineResources = async (maxMineId: number) => {
    try {
      console.log(`?? Fetching resources from mines 1-${maxMineId}...`);
      
      const aggregated = {
        inferidos: 0,
        indicados: 0,
        medidos: 0,
        probables: 0,
        probadas: 0
      };
      
      for (let id = 1; id <= maxMineId; id++) {
        try {
          const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
          const account = await server.getAccount(SIMULATION_ACCOUNT);
          
          const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
          })
            .addOperation(contract.call("get_mine", nativeToScVal(id, { type: "u32" })))
            .setTimeout(30)
            .build();

          const response = await server.simulateTransaction(transaction);
          
          if (SorobanRpc.Api.isSimulationSuccess(response)) {
            const mineData = scValToNative(response.result?.retval);
            if (mineData && mineData.enabled) {
              aggregated.inferidos += Number(mineData.inferidos_gm || 0);
              aggregated.indicados += Number(mineData.indicados_gm || 0);
              aggregated.medidos += Number(mineData.medidos_gm || 0);
              aggregated.probables += Number(mineData.probables_gm || 0);
              aggregated.probadas += Number(mineData.probadas_gm || 0);
            }
          }
        } catch (err) {
          console.log(`Mine ${id} not found or disabled`);
        }
      }
      
      console.log("?? Aggregated resources:", aggregated);
      return aggregated;
    } catch (err: any) {
      console.error("? Error aggregating mine resources:", err);
      return null;
    }
  };

  return {
    loading,
    error,
    getMineCapacity,
    getGoldPrice,
    getTotalMinted,
    getMineData,
    getActiveMinesCount,
    getTotalCapacityAllMines,
    getAggregatedMineResources,
  };
}






