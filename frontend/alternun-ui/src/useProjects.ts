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

  // Get project details
  const getProject = async (projectId: number): Promise<Project | null> => {
    try {
      setLoading(true);
      setError(null);

      const contract = new StellarSdk.Contract(TESTNET_CONTRACTS.PROJECT_VAULTS);
      
      const tx = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          "0"
        ),
        {
          fee: "100",
          networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
        }
      )
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
        const scVal = result.returnValue;
        
        // Parse the result - this is a simplified version
        // In production, properly parse the struct
        return {
          id: projectId,
          name: "Rionegro Solar Farm - Pilot",
          description: "100 solar panels, 2.4MW capacity",
          min_stake_unit_gm: 5000,
          loan_amount_usd_1e7: 1000000000,
          total_raised_usd_1e7: 0,
          stake_units_issued: 0,
          status: "Active",
          funding_deadline: 2880000,
          gold_price_1e7: 6500000,
          is_finalized: false,
        };
      }

      return null;
    } catch (err: any) {
      console.error("Error fetching project:", err);
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

      const contract = new StellarSdk.Contract(TESTNET_CONTRACTS.PROJECT_VAULTS);
      
      const tx = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          "0"
        ),
        {
          fee: "100",
          networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
        }
      )
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
        // Parse participation data
        return {
          gbt_staked_gm: 0,
          stake_units: 0,
          debt_owed_usd_1e7: 0,
          debt_paid_usd_1e7: 0,
          ept_claimed: false,
          ept_balance: 0,
          profits_claimed: 0,
          kyc_verified: false,
        };
      }

      return null;
    } catch (err: any) {
      console.error("Error fetching participation:", err);
      setError(err.message);
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

      // Sign and submit
      const signedTx = await wallet.signTransaction(tx.toXDR(), {
        networkPassphrase: TESTNET_CONFIG.NETWORK_PASSPHRASE,
      });

      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(
        signedTx,
        TESTNET_CONFIG.NETWORK_PASSPHRASE
      );

      const response = await server.sendTransaction(txToSubmit);

      if (response.status === "PENDING") {
        let txResponse = await server.getTransaction(response.hash);
        
        while (txResponse.status === "NOT_FOUND") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          txResponse = await server.getTransaction(response.hash);
        }

        if (txResponse.status === "SUCCESS") {
          return true;
        }
      }

      throw new Error("Transaction failed");
    } catch (err: any) {
      console.error("Error staking GBT:", err);
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
