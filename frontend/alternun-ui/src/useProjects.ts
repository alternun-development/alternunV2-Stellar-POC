import { useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { TESTNET_CONTRACTS, TESTNET_CONFIG } from "./contracts.config";

interface Project {
  id: number;
  name: string;
  description: string;
  min_stake_unit_gm: number;
  loan_amount_usd_1e7: number;
  total_raised_usd_1e7: number;
  stake_units_issued: number;
  status: string;
  funding_deadline: number;
  gold_price_1e7: number;
  is_finalized: boolean;
}

interface UserParticipation {
  gbt_staked_gm: number;
  stake_units: number;
  debt_owed_usd_1e7: number;
  debt_paid_usd_1e7: number;
  ept_claimed: boolean;
  ept_balance: number;
  profits_claimed: number;
  kyc_verified: boolean;
}

export function useProjects() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const server = new StellarSdk.SorobanRpc.Server(TESTNET_CONFIG.RPC_URL);

  // Helper to parse ProjectStatus enum
  const parseProjectStatus = (scVal: any): string => {
    if (!scVal || !scVal._value) return "Unknown";
    
    const statusMap: { [key: string]: string } = {
      "Proposed": "Proposed",
      "Active": "Active",
      "Funded": "Funded",
      "InConstruction": "InConstruction",
      "Operational": "Operational",
      "Completed": "Completed",
      "Failed": "Failed",
    };

    const statusName = scVal._value?._attributes?.name || scVal._attributes?.name;
    return statusMap[statusName] || "Unknown";
  };

  // Helper to parse i128
  const parseI128 = (scVal: any): number => {
    if (!scVal) return 0;
    try {
      if (typeof scVal === 'number') return scVal;
      if (scVal._value !== undefined) return Number(scVal._value);
      return Number(scVal);
    } catch {
      return 0;
    }
  };

  // Helper to parse u32
  const parseU32 = (scVal: any): number => {
    if (!scVal) return 0;
    try {
      if (typeof scVal === 'number') return scVal;
      if (scVal._value !== undefined) return Number(scVal._value);
      return Number(scVal);
    } catch {
      return 0;
    }
  };

  // Helper to parse String
  const parseString = (scVal: any): string => {
    if (!scVal) return "";
    try {
      if (typeof scVal === 'string') return scVal;
      if (scVal._value !== undefined) return String(scVal._value);
      return String(scVal);
    } catch {
      return "";
    }
  };

  // Helper to parse bool
  const parseBool = (scVal: any): boolean => {
    if (!scVal) return false;
    try {
      if (typeof scVal === 'boolean') return scVal;
      if (scVal._value !== undefined) return Boolean(scVal._value);
      return Boolean(scVal);
    } catch {
      return false;
    }
  };

  // Get project details from blockchain
  const getProject = async (projectId: number): Promise<Project | null> => {
    try {
      setLoading(true);
      setError(null);

      console.log(`?? Fetching project ${projectId} from blockchain...`);

      const contract = new StellarSdk.Contract(TESTNET_CONTRACTS.PROJECT_VAULTS);
      
      // Create a dummy source account for simulation
      const sourceAccount = new StellarSdk.Account(
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "0"
      );

      const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "get_project",
            StellarSdk.nativeToScVal(projectId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const result = await server.simulateTransaction(tx);

      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
        console.log("? Raw response:", result.returnValue);
        
        // Parse the struct returned by contract
        const projectStruct = result.returnValue as any;
        
        // Extract fields from the struct
        const fields = projectStruct._value || [];
        
        const project: Project = {
          id: parseU32(fields[0]),
          name: parseString(fields[1]),
          description: parseString(fields[2]),
          min_stake_unit_gm: parseI128(fields[3]),
          loan_amount_usd_1e7: parseI128(fields[4]),
          total_raised_usd_1e7: parseI128(fields[6]),
          stake_units_issued: parseU32(fields[7]),
          status: parseProjectStatus(fields[8]),
          funding_deadline: parseU32(fields[11]),
          gold_price_1e7: parseI128(fields[12]),
          is_finalized: parseBool(fields[13]),
        };

        console.log("? Parsed project:", project);
        return project;
      } else {
        console.error("? Simulation failed:", result);
        setError("Failed to fetch project from blockchain");
        return null;
      }
    } catch (err: any) {
      console.error("? Error fetching project:", err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Get user participation in project
  const getParticipation = async (
    userAddress: string,
    projectId: number
  ): Promise<UserParticipation | null> => {
    try {
      setLoading(true);
      setError(null);

      console.log(`?? Fetching participation for ${userAddress} in project ${projectId}...`);

      const contract = new StellarSdk.Contract(TESTNET_CONTRACTS.PROJECT_VAULTS);
      
      const sourceAccount = new StellarSdk.Account(
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "0"
      );

      const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "get_participation",
            StellarSdk.Address.fromString(userAddress).toScVal(),
            StellarSdk.nativeToScVal(projectId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const result = await server.simulateTransaction(tx);

      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
        console.log("? Raw participation:", result.returnValue);
        
        const participationStruct = result.returnValue as any;
        const fields = participationStruct._value || [];

        const participation: UserParticipation = {
          gbt_staked_gm: parseI128(fields[0]),
          stake_units: parseU32(fields[1]),
          debt_owed_usd_1e7: parseI128(fields[2]),
          debt_paid_usd_1e7: parseI128(fields[3]),
          ept_claimed: parseBool(fields[4]),
          ept_balance: parseI128(fields[5]),
          profits_claimed: parseI128(fields[6]),
          kyc_verified: parseBool(fields[7]),
        };

        console.log("? Parsed participation:", participation);
        return participation;
      } else {
        console.log("?? No participation found (user hasn't staked yet)");
        return null;
      }
    } catch (err: any) {
      console.error("? Error fetching participation:", err);
      // Don't set error for participation - it's normal if user hasn't staked
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Stake GBT in project
  const stakeGBT = async (
    wallet: any,
    projectId: number,
    goldPrice: number
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      if (!wallet.connected || !wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      console.log(`?? Staking GBT in project ${projectId}...`);

      const contract = new StellarSdk.Contract(TESTNET_CONTRACTS.PROJECT_VAULTS);
      const account = await server.getAccount(wallet.publicKey);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "stake_gbt",
            StellarSdk.Address.fromString(wallet.publicKey).toScVal(),
            StellarSdk.nativeToScVal(projectId, { type: "u32" }),
            StellarSdk.nativeToScVal(goldPrice, { type: "i128" })
          )
        )
        .setTimeout(30)
        .build();

      // Sign transaction
      const signedTx = await wallet.signTransaction(tx.toXDR(), {
        networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
      });

      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(
        signedTx,
        TESTNET_CONFIG.NETWORK_PASSPHRASE
      );

      // Submit to blockchain
      const response = await server.sendTransaction(txToSubmit);
      console.log("?? Transaction sent:", response.hash);

      if (response.status === "PENDING") {
        // Poll for result
        let txResponse = await server.getTransaction(response.hash);
        let attempts = 0;
        
        while (txResponse.status === "NOT_FOUND" && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          txResponse = await server.getTransaction(response.hash);
          attempts++;
        }

        if (txResponse.status === "SUCCESS") {
          console.log("? Stake successful!");
          return true;
        } else {
          console.error("? Transaction failed:", txResponse);
          throw new Error("Transaction failed");
        }
      }

      throw new Error("Transaction not accepted");
    } catch (err: any) {
      console.error("? Error staking GBT:", err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getProject,
    getParticipation,
    stakeGBT,
  };
}
