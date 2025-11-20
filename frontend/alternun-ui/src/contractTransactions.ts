import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { TESTNET_CONTRACTS, TESTNET_CONFIG } from "./contracts.config";

const server = new SorobanRpc.Server(TESTNET_CONFIG.RPC_URL);

export interface MintResult {
  success: boolean;
  gbtMinted?: number;
  transactionHash?: string;
  error?: string;
}

export async function executeMint(
  userPublicKey: string,
  amountUsd: number,
  maxMineId: number
): Promise<MintResult> {
  try {
    console.log("?? Starting mint transaction...");
    console.log("User:", userPublicKey);
    console.log("Amount USD:", amountUsd);
    console.log("Max Mine ID:", maxMineId);

    const amountScaled = Math.floor(amountUsd * 10000000);
    console.log("Amount scaled (1e7):", amountScaled);

    const sourceAccount = await server.getAccount(userPublicKey);
    console.log("? Retrieved user account");

    const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
    const payerAddress = Address.fromString(userPublicKey);

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: (Number(BASE_FEE) * 100000).toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "mint",
          nativeToScVal(payerAddress, { type: "address" }),
          nativeToScVal(amountScaled, { type: "i128" }),
          nativeToScVal(maxMineId, { type: "u32" })
        )
      )
      .setTimeout(30)
      .build();

    console.log("?? Transaction built");
    console.log("?? Simulating transaction...");
    
    const simulated = await server.simulateTransaction(transaction);
    console.log("?? Simulation result:", simulated);

    if (!SorobanRpc.Api.isSimulationSuccess(simulated)) {
      console.error("? Simulation failed:", simulated);
      let errorMsg = "Transaction simulation failed.";
      if (simulated.error) {
        errorMsg += ` Error: ${simulated.error}`;
      }
      return { success: false, error: errorMsg };
    }

    console.log("? Simulation successful");

    const preparedTransaction = SorobanRpc.assembleTransaction(
      transaction,
      simulated
    ).build();

    console.log("?? Transaction prepared with auth");

    const xdrString = preparedTransaction.toXDR();
    console.log("?? Requesting signature from Freighter...");

    const signedXdr = await signTransaction(xdrString, {
      network: "TESTNET",
      networkPassphrase: Networks.TESTNET,
      accountToSign: userPublicKey,
    });

    console.log("? Transaction signed");

    const signedTransaction = TransactionBuilder.fromXDR(
      signedXdr,
      Networks.TESTNET
    );

    console.log("?? Submitting transaction to network...");

    const response = await server.sendTransaction(signedTransaction);
    console.log("?? Submit response:", response);

    if (response.status === "PENDING" || response.status === "SUCCESS") {
      console.log("? Transaction submitted, waiting for confirmation...");

      const hash = response.hash;

      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const txResponse = await server.getTransaction(hash);
          console.log(`?? Poll attempt ${i + 1}/30, status:`, txResponse.status);

          if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
            console.log("? Transaction confirmed!");
            const gbtMinted = (amountUsd * 0.98) / 0.65;
            return {
              success: true,
              transactionHash: hash,
              gbtMinted: gbtMinted,
            };
          } else if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
            console.error("? Transaction failed:", txResponse);
            return {
              success: false,
              error: "Transaction failed on network"
            };
          }
        } catch (err) {
          console.log(`? Waiting for transaction... (${i + 1}/30)`);
        }
      }

      return {
        success: false,
        error: "Transaction timeout - check Stellar Explorer"
      };
    } else {
      console.error("? Transaction submission failed:", response);
      return {
        success: false,
        error: `Submission failed: ${response.status}`
      };
    }

  } catch (err: any) {
    console.error("? Mint transaction error:", err);
    return {
      success: false,
      error: err.message || "Unknown error occurred"
    };
  }
}


/**
 * Register or update a mine
 */
export async function upsertMine(
  userPublicKey: string,
  mineId: number,
  inferidos_gm: number,
  indicados_gm: number,
  medidos_gm: number,
  probables_gm: number,
  probadas_gm: number,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("?? Upserting mine...");
    
    const sourceAccount = await server.getAccount(userPublicKey);
    const contract = new Contract(TESTNET_CONTRACTS.GBT_MINTER);
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: (Number(BASE_FEE) * 50000).toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "upsert_mine",
          nativeToScVal(mineId, { type: "u32" }),
          nativeToScVal(inferidos_gm, { type: "i128" }),
          nativeToScVal(indicados_gm, { type: "i128" }),
          nativeToScVal(medidos_gm, { type: "i128" }),
          nativeToScVal(probables_gm, { type: "i128" }),
          nativeToScVal(probadas_gm, { type: "i128" }),
          nativeToScVal(enabled, { type: "bool" })
        )
      )
      .setTimeout(30)
      .build();

    console.log("?? Simulating...");
    const simulated = await server.simulateTransaction(transaction);
    
    if (!SorobanRpc.Api.isSimulationSuccess(simulated)) {
      console.error("? Simulation failed:", simulated);
      return { success: false, error: "Simulation failed" };
    }

    const preparedTransaction = SorobanRpc.assembleTransaction(transaction, simulated).build();
    const xdrString = preparedTransaction.toXDR();
    
    console.log("?? Requesting signature...");
    const signedXdr = await signTransaction(xdrString, {
      network: "TESTNET",
      networkPassphrase: Networks.TESTNET,
      accountToSign: userPublicKey,
    });

    const signedTransaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    
    console.log("?? Submitting...");
    const response = await server.sendTransaction(signedTransaction);
    
    if (response.status === "PENDING" || response.status === "SUCCESS") {
      console.log("? Mine upserted!");
      return { success: true };
    }
    
    return { success: false, error: "Transaction failed" };
  } catch (err: any) {
    console.error("? Upsert mine error:", err);
    return { success: false, error: err.message };
  }
}
