import { 
  Asset,
  Keypair,
  Networks,
  Operation,
  Server,
  TransactionBuilder,
  BASE_FEE
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_CODE = "USDC";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

export async function setupUSDCTrustline(userPublicKey: string): Promise<boolean> {
  try {
    console.log("?? Setting up USDC trustline...");
    
    const server = new Server(HORIZON_URL);
    const sourceAccount = await server.loadAccount(userPublicKey);
    
    const usdcAsset = new Asset(USDC_CODE, USDC_ISSUER);
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: usdcAsset,
        })
      )
      .setTimeout(30)
      .build();
    
    console.log("?? Signing trustline transaction with Freighter...");
    const signedXdr = await signTransaction(transaction.toXDR(), {
      network: "TESTNET",
      networkPassphrase: Networks.TESTNET,
      accountToSign: userPublicKey,
    });
    
    const signedTransaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    
    console.log("?? Submitting trustline transaction...");
    const result = await server.submitTransaction(signedTransaction);
    
    console.log("? USDC Trustline established!", result);
    return true;
  } catch (err: any) {
    console.error("? Trustline error:", err);
    alert(`Failed to setup trustline: ${err.message}`);
    return false;
  }
}

