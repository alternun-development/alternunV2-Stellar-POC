import React, { useState } from "react";

interface FlowState {
  step: number;
  userGBT: number;
  userUSDC: number;
  stakedGBT: number;
  pGBTBalance: number;
  ePTBalance: number;
  selectedProject: number | null;
}

export function UserFlow() {
  const [flowState, setFlowState] = useState<FlowState>({
    step: 1,
    userGBT: 0,
    userUSDC: 5000, // User starts with $5000 USDC
    stakedGBT: 0,
    pGBTBalance: 0,
    ePTBalance: 0,
    selectedProject: null
  });

  const handleMint = (usdAmount: number) => {
    const fee = usdAmount * 0.02;
    const netAmount = usdAmount - fee;
    const gbtAmount = netAmount / 65; // $65 per gram

    setFlowState(prev => ({
      ...prev,
      step: 2,
      userUSDC: prev.userUSDC - usdAmount,
      userGBT: prev.userGBT + gbtAmount
    }));
  };

  const handleStake = (projectId: number, gbtAmount: number) => {
    setFlowState(prev => ({
      ...prev,
      step: 3,
      userGBT: prev.userGBT - gbtAmount,
      stakedGBT: prev.stakedGBT + gbtAmount,
      pGBTBalance: prev.pGBTBalance + gbtAmount,
      selectedProject: projectId
    }));
  };

  const handleConvertToEPT = (pGBTAmount: number) => {
    setFlowState(prev => ({
      ...prev,
      step: 4,
      pGBTBalance: prev.pGBTBalance - pGBTAmount,
      ePTBalance: prev.ePTBalance + pGBTAmount
    }));
  };

  const resetFlow = () => {
    setFlowState({
      step: 1,
      userGBT: 0,
      userUSDC: 5000,
      stakedGBT: 0,
      pGBTBalance: 0,
      ePTBalance: 0,
      selectedProject: null
    });
  };

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: "rgba(0,0,0,0.8)", 
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem"
    }}>
      <div style={{
        backgroundColor: "#1f2937",
        borderRadius: "16px",
        padding: "2rem",
        maxWidth: "600px",
        width: "100%",
        border: "2px solid #14b8a6"
      }}>
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#14b8a6", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            Alternun User Journey Demo
          </h2>
          
          {/* Progress bar */}
          <div style={{ display: "flex", marginBottom: "1.5rem" }}>
            {[1, 2, 3, 4].map((stepNum) => (
              <div key={stepNum} style={{
                flex: 1,
                height: "4px",
                backgroundColor: flowState.step >= stepNum ? "#14b8a6" : "#374151",
                marginRight: stepNum < 4 ? "4px" : "0",
                borderRadius: "2px"
              }} />
            ))}
          </div>

          {/* User Wallet Status */}
          <div style={{
            backgroundColor: "#374151",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1.5rem"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#f59e0b", fontSize: "1.25rem", fontWeight: "bold" }}>
                  ${flowState.userUSDC.toFixed(0)}
                </div>
                <div style={{ color: "#d1d5db", fontSize: "0.75rem" }}>USDC</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#14b8a6", fontSize: "1.25rem", fontWeight: "bold" }}>
                  {flowState.userGBT.toFixed(2)}g
                </div>
                <div style={{ color: "#d1d5db", fontSize: "0.75rem" }}>GBT</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#3b82f6", fontSize: "1.25rem", fontWeight: "bold" }}>
                  {flowState.pGBTBalance.toFixed(2)}g
                </div>
                <div style={{ color: "#d1d5db", fontSize: "0.75rem" }}>pGBT</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#a855f7", fontSize: "1.25rem", fontWeight: "bold" }}>
                  {flowState.ePTBalance.toFixed(2)}g
                </div>
                <div style={{ color: "#d1d5db", fontSize: "0.75rem" }}>ePT</div>
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {flowState.step === 1 && (
          <div>
            <h3 style={{ color: "white", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
              Step 1: Mint GBT with USDC
            </h3>
            <p style={{ color: "#d1d5db", marginBottom: "1rem" }}>
              Convert your USDC into gold-backed tokens. Current gold price: $65/gram
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
              {[500, 1000, 2000].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleMint(amount)}
                  style={{
                    backgroundColor: "#14b8a6",
                    color: "white",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "600"
                  }}
                >
                  Mint ${amount}
                </button>
              ))}
            </div>
          </div>
        )}

        {flowState.step === 2 && (
          <div>
            <h3 style={{ color: "white", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
              Step 2: Stake GBT in Projects
            </h3>
            <p style={{ color: "#d1d5db", marginBottom: "1rem" }}>
              You now have {flowState.userGBT.toFixed(2)} grams of GBT. Stake in regenerative projects to earn returns.
            </p>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[
                { id: 1, name: "?? Nechí Solar Farm", stake: Math.min(5, flowState.userGBT) },
                { id: 2, name: "?? Amalfi Reforestation", stake: Math.min(3, flowState.userGBT) },
                { id: 3, name: "?? Water Treatment", stake: Math.min(4, flowState.userGBT) }
              ].map(project => (
                <button
                  key={project.id}
                  onClick={() => handleStake(project.id, project.stake)}
                  disabled={flowState.userGBT < project.stake}
                  style={{
                    backgroundColor: flowState.userGBT >= project.stake ? "#10b981" : "#6b7280",
                    color: "white",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "none",
                    cursor: flowState.userGBT >= project.stake ? "pointer" : "not-allowed",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    textAlign: "left"
                  }}
                >
                  {project.name} - Stake {project.stake.toFixed(1)}g GBT
                </button>
              ))}
            </div>
          </div>
        )}

        {flowState.step === 3 && (
          <div>
            <h3 style={{ color: "white", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
              Step 3: Convert pGBT to ePT
            </h3>
            <p style={{ color: "#d1d5db", marginBottom: "1rem" }}>
              You have {flowState.pGBTBalance.toFixed(2)}g pGBT from your project stake. 
              Convert to tradeable ePT tokens (simulating 50% value repayment).
            </p>
            <button
              onClick={() => handleConvertToEPT(flowState.pGBTBalance * 0.6)}
              style={{
                backgroundColor: "#a855f7",
                color: "white",
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
                width: "100%"
              }}
            >
              Convert {(flowState.pGBTBalance * 0.6).toFixed(2)}g pGBT ? ePT
            </button>
          </div>
        )}

        {flowState.step === 4 && (
          <div>
            <h3 style={{ color: "white", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
              ?? Journey Complete!
            </h3>
            <div style={{ color: "#d1d5db", marginBottom: "1.5rem" }}>
              <p style={{ marginBottom: "0.5rem" }}>You successfully:</p>
              <ul style={{ paddingLeft: "1rem", marginBottom: "1rem" }}>
                <li>Minted GBT with your USDC</li>
                <li>Staked GBT in a regenerative project</li>
                <li>Received pGBT project participation tokens</li>
                <li>Converted pGBT to tradeable ePT equity tokens</li>
              </ul>
              <p style={{ fontSize: "0.875rem", color: "#10b981" }}>
                Your investment is now funding real environmental impact while maintaining gold backing!
              </p>
            </div>
            
            <button
              onClick={resetFlow}
              style={{
                backgroundColor: "#14b8a6",
                color: "white",
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
                width: "100%"
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
