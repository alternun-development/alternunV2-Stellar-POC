import { useState, useEffect, useCallback } from "react";
import { useContracts } from "./useContracts";
import { MINE_DATA } from "./contracts.config";
import { executeMint } from "./contractTransactions";
import { setupUSDCTrustline } from "./setupTrustline";

interface MintTabProps {
  wallet: any;
}

export function MintTab({ wallet }: MintTabProps) {
  const [amount, setAmount] = useState("1000");
  const [maxMineId, setMaxMineId] = useState<number>(2);
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [mineCapacity, setMineCapacity] = useState<number | null>(null);
  const [gbtOutput, setGbtOutput] = useState<number>(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const { loading, error, getMineCapacity, getGoldPrice, getActiveMinesCount, getTotalCapacityAllMines } = useContracts();

  // Load initial data from contracts - SOLO UNA VEZ
  useEffect(() => {
    if (dataLoaded) return; // Evitar múltiples cargas
    
    console.log("?? MintTab mounted - Loading contract data...");
    
    const loadData = async () => {
      try {
        console.log("?? Fetching active mines count...");
        const minesCount = await getActiveMinesCount(10);
        console.log("?? Active mines:", minesCount);
        setMaxMineId(minesCount);
        
        console.log("?? Fetching gold price...");
        const price = await getGoldPrice();
        console.log("?? Received price:", price);
        if (price && price > 0) {
          setGoldPrice(price);
        }
        
        console.log("?? Fetching total capacity for all mines...");
        const capacity = await getTotalCapacityAllMines(minesCount);
        console.log("?? Received capacity:", capacity);
        if (capacity && capacity > 0) {
          setMineCapacity(capacity);
        }
        
        setDataLoaded(true);
        setDataLoaded(true);
      } catch (err) {
        console.error("? Error loading data:", err);
        setDataLoaded(true); // Marcar como cargado incluso si falla
      }
    };

    loadData();
  }, [dataLoaded]); // Solo depende de dataLoaded

  // Calculate GBT output whenever amount changes
  useEffect(() => {
    if (goldPrice && goldPrice > 0) {
      const amountNum = Number(amount) || 0;
      const fee = amountNum * 0.02;
      const netAmount = amountNum - fee;
      const gbt = netAmount / goldPrice;
      setGbtOutput(gbt);
    }
  }, [amount, goldPrice]);

  const handleSetupTrustline = async () => {
    if (!wallet.connected) {
      alert("Please connect your wallet first");
      return;
    }
    
    const success = await setupUSDCTrustline(wallet.publicKey);
    if (success) {
      alert("? USDC Trustline established! You can now receive USDC.");
    }
  };

  const handleMint = async () => {
    if (!wallet.connected) {
      alert("Please connect your wallet first");
      return;
    }
    
    const amountNum = Number(amount) || 0;
    
    if (amountNum <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    if (!confirm(`Mint ${gbtOutput.toFixed(3)} grams of GBT for ${amountNum} USD?`)) {
      return;
    }
    
    console.log("?? Executing real mint transaction...");
    
    try {
      const result = await executeMint(
        wallet.publicKey,
        amountNum,
        MINE_DATA.AL1.id
      );
      
      if (result.success) {
        alert(`? Mint Successful!\n\nGBT Minted: ${result.gbtMinted?.toFixed(3)} grams\n\nTransaction: ${result.transactionHash}`);
        console.log("? Mint result:", result);
      } else {
        alert(`? Mint Failed\n\n${result.error}`);
        console.error("? Mint failed:", result);
      }
    } catch (err: any) {
      alert(`? Error: ${err.message}`);
      console.error("? Mint error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Mint Gold-Backed Tokens</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Transform your USD into GBT tokens backed by underground gold reserves from AL-1 Mine.
        </p>
      </div>

      {error && (
        <div style={{
          backgroundColor: "#991b1b",
          color: "white",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem"
        }}>
          Error: {error}
        </div>
      )}

      <div className="card">
        <div className="grid-2">
          <div className="space-y-4">
            <div>
              <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Investment Amount (USD)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontWeight: "500" }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: "32px", fontSize: "1.125rem", fontWeight: "600" }}
                  placeholder="1000"
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Mine Info */}
            <div style={{ 
              padding: "12px", 
              background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)",
              borderRadius: "8px",
              border: "1px solid #f59e0b"
            }}>
              <div>
                <p className="font-bold text-white" style={{ fontSize: "0.875rem" }}>?? {MINE_DATA.AL1.name}</p>
                <p style={{ fontSize: "0.75rem", color: "#fef3c7" }}>
                  Resources: {(MINE_DATA.AL1.inferidos_gm / 1000000).toFixed(1)}k grams (Inferred)
                </p>
                <p style={{ fontSize: "0.75rem", color: "#fde68a" }}>
                  Capacity: {mineCapacity !== null ? `${mineCapacity.toFixed(2)} grams mintable` : "Loading..."}
                </p>
              </div>
            </div>
            
            {wallet.connected && (
              <div style={{ 
                padding: "12px", 
                background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
                borderRadius: "8px",
                border: "1px solid #10b981"
              }}>
                <div className="flex items-center space-x-4">
                  <div style={{ width: "12px", height: "12px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                  <div>
                    <p className="font-bold text-white">Wallet Connected</p>
                    <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#ccfbf1" }}>{wallet.publicKey.substring(0, 20)}...</p>
                    <p style={{ fontSize: "0.875rem", color: "#d1fae5" }}>
                      Network: Testnet ?
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleSetupTrustline}
              className="btn-secondary"
              style={{ 
                width: "100%", 
                padding: "12px",
                marginBottom: "0.5rem",
                opacity: (!wallet.connected || loading) ? 0.6 : 1
              }}
              disabled={!wallet.connected || loading}
            >
              Setup USDC Trustline
            </button>
            
            <button
              onClick={handleMint}
              className="btn-primary"
              style={{ 
                width: "100%", 
                padding: "16px",
                opacity: (!wallet.connected || loading) ? 0.6 : 1
              }}
              disabled={!wallet.connected || loading}
            >
              {loading ? "Loading..." : wallet.connected ? "Mint GBT Tokens" : "Connect Wallet to Mint"}
            </button>
            
            {!wallet.connected && (
              <div className="text-center">
                <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                  Install{" "}
                  <a 
                    href="https://www.freighter.app/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-alternun"
                    style={{ textDecoration: "underline" }}
                  >
                    Freighter Wallet
                  </a>
                  {" "}to interact with contracts
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Mint Preview {goldPrice && "(Live from Contract)"}
            </h3>
            <div className="space-y-4">
              <div className="preview-card">
                <div className="flex justify-between items-center">
                  <span className="text-gray">Gold Price:</span>
                  <span className="text-2xl font-bold text-gold">
                    {goldPrice ? `$${goldPrice.toFixed(2)}/gram` : "Loading..."}
                  </span>
                </div>
                {goldPrice && goldPrice > 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem" }}>
                    ? Live from Oracle Contract
                  </p>
                )}
              </div>
              
              <div className="grid-2" style={{ gap: "1rem" }}>
                <div className="preview-card">
                  <p style={{ fontSize: "0.875rem", color: "#d1d5db" }}>Fee (2%)</p>
                  <p className="text-xl font-bold" style={{ color: "#ef4444" }}>
                    ${((Number(amount) || 1000) * 0.02).toFixed(2)}
                  </p>
                </div>
                <div className="preview-card">
                  <p style={{ fontSize: "0.875rem", color: "#d1d5db" }}>Net Amount</p>
                  <p className="text-xl font-bold" style={{ color: "#10b981" }}>
                    ${((Number(amount) || 1000) * 0.98).toFixed(2)}
                  </p>
                </div>
              </div>
              
              <div className="preview-card" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", border: "1px solid #14b8a6" }}>
                <div className="text-center">
                  <p style={{ fontSize: "0.875rem", color: "#ccfbf1", fontWeight: "500" }}>GBT Output</p>
                  <p className="text-3xl font-bold text-white">
                    {gbtOutput > 0 ? `${gbtOutput.toFixed(3)} grams` : "Calculating..."}
                  </p>
                </div>
              </div>
              
              <div className="preview-card" style={{ backgroundColor: "#374151" }}>
                <p style={{ fontSize: "0.75rem", color: "#d1d5db", lineHeight: "1.5" }}>
                  <span className="font-bold">Treasury Distribution:</span><br/>
                  50% Projects • 30% Recovery • 20% Alternun
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}










