import React, { useState } from "react";
import "./App.css";
import { useWallet } from "./useWallet";
import { MintTab } from "./MintTab";
import { DashboardTab } from "./DashboardTab";
import { AdminTab } from "./AdminTab";

// Types for our application
interface ProjectData {
  id: number;
  name: string;
  description: string;
  target_gbt_gm: number;
  raised_gbt_gm: number;
  status: "Proposed" | "Active" | "Funded" | "Completed" | "Cancelled";
}

interface UserParticipation {
  gbt_staked_gm: number;
  pgbt_balance: number;
  ept_balance: number;
  profits_claimed: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<"mint" | "projects" | "dashboard" | "admin">("mint");
  const wallet = useWallet();
  
  // Mock data for demonstration
  const mockProjects: ProjectData[] = [
    {
      id: 1,
      name: "?? Nechí Solar Farm",
      description: "100MW solar installation providing clean energy to 50,000 homes while generating sustainable returns.",
      target_gbt_gm: 50000000,
      raised_gbt_gm: 32000000,
      status: "Active"
    },
    {
      id: 2, 
      name: "?? Amalfi Reforestation",
      description: "Reforestation of 500 hectares with native species, creating carbon credits and biodiversity.",
      target_gbt_gm: 25000000,
      raised_gbt_gm: 8500000,
      status: "Active"
    },
    {
      id: 3,
      name: "?? Girardota Water Treatment", 
      description: "Advanced water treatment facility processing 10,000L/day ensuring clean water access.",
      target_gbt_gm: 30000000,
      raised_gbt_gm: 30000000,
      status: "Funded"
    }
  ];

  const mockUserParticipation: UserParticipation = {
    gbt_staked_gm: 15500000,
    pgbt_balance: 12000000,
    ept_balance: 3500000,
    profits_claimed: 850000
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="header-gradient" style={{ padding: "1rem 0" }}>
        <div className="max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div style={{ 
                width: "40px", 
                height: "40px", 
                background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center", 
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "1.2rem"
              }}>
                A
              </div>
              <div>
                <h1 className="text-2xl font-bold text-alternun">ALTERNUN</h1>
                <p style={{ fontSize: "0.75rem", color: "#14b8a6", fontWeight: "500" }}>
                  Digital Gold Mining
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-4">
                {[
                  { key: "mint", label: "Mint GBT" },
                  { key: "projects", label: "Projects" },
                  { key: "dashboard", label: "Dashboard" },
                  { key: "admin", label: "Admin" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      padding: "8px 16px",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: activeTab === tab.key ? "#14b8a6" : "transparent",
                      color: activeTab === tab.key ? "white" : "#d1d5db"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              
              {wallet.connected && (
                <div style={{ 
                  fontSize: "0.75rem", 
                  color: "#14b8a6", 
                  background: "#374151", 
                  padding: "4px 12px", 
                  borderRadius: "20px",
                  border: "1px solid #14b8a6"
                }}>
                  {wallet.publicKey.substring(0, 8)}...
                </div>
              )}
              
              <button
                onClick={() => {
                  console.log("??? Connect button clicked! Connected:", wallet.connected);
                  if (wallet.connected) {
                    wallet.disconnect();
                  } else {
                    wallet.connect();
                  }
                }}
                disabled={wallet.loading}
                className="btn-primary"
                style={{ opacity: wallet.loading ? 0.5 : 1 }}
              >
                {wallet.loading ? "Connecting..." : wallet.connected ? "Connected ?" : "Connect Wallet"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl py-8 px-4">
        {activeTab === "mint" && <MintTab wallet={wallet} />}
        {activeTab === "projects" && <ProjectsTab projects={mockProjects} userParticipation={mockUserParticipation} wallet={wallet} />}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "admin" && <AdminTab wallet={wallet} />}
      </main>
    </div>
  );
}

// Projects Tab Component
function ProjectsTab({ projects, userParticipation, wallet }: { 
  projects: ProjectData[], 
  userParticipation: UserParticipation, 
  wallet: any 
}) {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [activeProjectTab, setActiveProjectTab] = useState<"available" | "my-stakes">("available");

  const handleStake = async (projectId: number) => {
    if (!wallet.connected) {
      alert("Please connect your wallet first");
      return;
    }
    alert(`Staking ${stakeAmount} GBT in project ${projectId}`);
    setStakeAmount("");
    setSelectedProject(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return { bg: "#065f46", text: "#10b981" };
      case "Funded": return { bg: "#1e3a8a", text: "#3b82f6" };
      case "Completed": return { bg: "#581c87", text: "#a855f7" };
      case "Proposed": return { bg: "#92400e", text: "#f59e0b" };
      default: return { bg: "#374151", text: "#9ca3af" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Regenerative Projects</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "48rem", margin: "0 auto" }}>
          Stake your GBT in regenerative projects across Colombia. Fund solar farms, reforestation, 
          and water treatment while earning sustainable returns.
        </p>
      </div>

      {/* User Portfolio Summary */}
      <div className="card" style={{ background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)", border: "2px solid #14b8a6" }}>
        <h3 className="text-2xl font-bold text-white mb-6 text-center">Your Portfolio</h3>
        <div className="grid-4">
          <div className="preview-card text-center">
            <div className="text-2xl font-bold text-alternun mb-2">
              {(userParticipation.gbt_staked_gm / 1000).toFixed(1)}
            </div>
            <p className="text-gray" style={{ fontSize: "0.875rem", fontWeight: "500" }}>GBT Staked (grams)</p>
          </div>
          <div className="preview-card text-center">
            <div className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
              {(userParticipation.pgbt_balance / 1000).toFixed(1)}
            </div>
            <p className="text-gray" style={{ fontSize: "0.875rem", fontWeight: "500" }}>pGBT Balance (grams)</p>
          </div>
          <div className="preview-card text-center">
            <div className="text-2xl font-bold" style={{ color: "#a855f7" }}>
              {(userParticipation.ept_balance / 1000).toFixed(1)}
            </div>
            <p className="text-gray" style={{ fontSize: "0.875rem", fontWeight: "500" }}>ePT Balance (grams)</p>
          </div>
          <div className="preview-card text-center">
            <div className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {(userParticipation.profits_claimed / 1000).toFixed(1)}
            </div>
            <p className="text-gray" style={{ fontSize: "0.875rem", fontWeight: "500" }}>Profits Claimed (grams)</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", background: "#374151", padding: "4px", borderRadius: "12px", border: "1px solid #6b7280" }}>
          <button
            onClick={() => setActiveProjectTab("available")}
            style={{
              padding: "8px 24px",
              fontSize: "0.875rem",
              fontWeight: "600",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: activeProjectTab === "available" ? "#14b8a6" : "transparent",
              color: activeProjectTab === "available" ? "white" : "#d1d5db"
            }}
          >
            Available Projects
          </button>
          <button
            onClick={() => setActiveProjectTab("my-stakes")}
            style={{
              padding: "8px 24px",
              fontSize: "0.875rem",
              fontWeight: "600", 
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: activeProjectTab === "my-stakes" ? "#14b8a6" : "transparent",
              color: activeProjectTab === "my-stakes" ? "white" : "#d1d5db"
            }}
          >
            My Stakes
          </button>
        </div>
      </div>

      {activeProjectTab === "available" && (
        <div className="space-y-6">
          {projects.map((project) => {
            const statusColors = getStatusColor(project.status);
            const progress = (project.raised_gbt_gm / project.target_gbt_gm) * 100;
            
            return (
              <div key={project.id} className="card">
                <div className="flex justify-between items-start mb-6">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center space-x-4 mb-3">
                      <h4 className="text-2xl font-bold text-white">{project.name}</h4>
                      <span style={{
                        padding: "4px 12px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        borderRadius: "20px",
                        backgroundColor: statusColors.bg,
                        color: statusColors.text,
                        border: `1px solid ${statusColors.text}`
                      }}>
                        {project.status}
                      </span>
                    </div>
                    <p className="text-gray" style={{ fontSize: "1rem", lineHeight: "1.6" }}>{project.description}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">Funding Progress</span>
                    <span className="text-alternun font-bold" style={{ fontSize: "1.125rem" }}>
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#374151",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${Math.min(progress, 100)}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #14b8a6, #0d9488)",
                      borderRadius: "4px",
                      transition: "width 0.5s ease"
                    }}></div>
                  </div>
                  <div className="flex justify-between text-gray mt-2" style={{ fontSize: "0.875rem" }}>
                    <span>{(project.raised_gbt_gm / 1000).toFixed(1)}k grams raised</span>
                    <span>{(project.target_gbt_gm / 1000).toFixed(1)}k grams target</span>
                  </div>
                </div>

                {/* Stake Section */}
                {project.status === "Active" && (
                  <div style={{ borderTop: "1px solid #6b7280", paddingTop: "1.5rem" }}>
                    {selectedProject === project.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                            Stake Amount (grams GBT)
                          </label>
                          <input
                            type="number"
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(e.target.value)}
                            className="input-field"
                            placeholder="100"
                          />
                        </div>
                        <div className="flex space-x-4">
                          <button
                            onClick={() => handleStake(project.id)}
                            disabled={!wallet.connected || !stakeAmount}
                            className="btn-primary"
                            style={{ flex: 1 }}
                          >
                            Confirm Stake
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProject(null);
                              setStakeAmount("");
                            }}
                            className="btn-secondary"
                            style={{ padding: "12px 24px" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedProject(project.id)}
                        disabled={!wallet.connected}
                        className="btn-primary"
                        style={{ 
                          width: "100%",
                          padding: "12px",
                          opacity: !wallet.connected ? 0.6 : 1
                        }}
                      >
                        {wallet.connected ? "Stake GBT in Project" : "Connect Wallet to Stake"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeProjectTab === "my-stakes" && (
        <div className="space-y-6">
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {/* Nechí Solar Farm Stake */}
            <div className="card" style={{ background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)", border: "1px solid #f59e0b" }}>
              <div className="flex items-center space-x-4 mb-4">
                <div style={{ fontSize: "1.5rem" }}>??</div>
                <h4 className="font-bold text-white" style={{ fontSize: "1.125rem" }}>Nechí Solar Farm</h4>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>GBT Staked</p>
                  <p className="text-alternun font-bold" style={{ fontSize: "1.125rem" }}>8.5</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>pGBT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#3b82f6" }}>6.0</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>ePT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#a855f7" }}>2.5</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <button 
                  className="btn-primary" 
                  style={{ width: "100%", fontSize: "0.875rem", padding: "8px 16px" }}
                  onClick={() => alert("Converting 3.0 pGBT to ePT (requires 50% value repayment)")}
                >
                  Convert to ePT
                </button>
                <button 
                  style={{
                    width: "100%",
                    backgroundColor: "#10b981",
                    color: "white",
                    fontWeight: "600",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = "#059669"}
                  onMouseOut={(e) => e.target.style.backgroundColor = "#10b981"}
                  onClick={() => alert("Claiming available profits: 0.3 grams GBT")}
                >
                  Claim Profits (0.3g)
                </button>
              </div>
            </div>

            {/* Amalfi Reforestation Stake */}
            <div className="card" style={{ background: "linear-gradient(135deg, #065f46 0%, #047857 100%)", border: "1px solid #10b981" }}>
              <div className="flex items-center space-x-4 mb-4">
                <div style={{ fontSize: "1.5rem" }}>??</div>
                <h4 className="font-bold text-white" style={{ fontSize: "1.125rem" }}>Amalfi Reforestation</h4>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>GBT Staked</p>
                  <p className="text-alternun font-bold" style={{ fontSize: "1.125rem" }}>4.2</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>pGBT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#3b82f6" }}>4.2</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>ePT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#a855f7" }}>0.0</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <button 
                  className="btn-primary" 
                  style={{ width: "100%", fontSize: "0.875rem", padding: "8px 16px" }}
                  onClick={() => alert("Converting pGBT to ePT (requires 50% value repayment)")}
                >
                  Convert to ePT
                </button>
                <button 
                  style={{
                    width: "100%",
                    backgroundColor: "#6b7280",
                    color: "#9ca3af",
                    fontWeight: "600",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "not-allowed",
                    fontSize: "0.875rem"
                  }}
                  disabled
                >
                  No Profits Yet
                </button>
              </div>
            </div>

            {/* Girardota Water Treatment Stake */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", border: "1px solid #3b82f6" }}>
              <div className="flex items-center space-x-4 mb-4">
                <div style={{ fontSize: "1.5rem" }}>??</div>
                <h4 className="font-bold text-white" style={{ fontSize: "1.125rem" }}>Water Treatment</h4>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>GBT Staked</p>
                  <p className="text-alternun font-bold" style={{ fontSize: "1.125rem" }}>2.8</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>pGBT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#3b82f6" }}>1.8</p>
                </div>
                <div className="text-center">
                  <p style={{ fontSize: "0.75rem", color: "#d1d5db", fontWeight: "500" }}>ePT</p>
                  <p className="font-bold" style={{ fontSize: "1.125rem", color: "#a855f7" }}>1.0</p>
                </div>
              </div>
              
              <div style={{
                backgroundColor: "#10b981",
                padding: "8px",
                borderRadius: "6px",
                marginBottom: "1rem",
                border: "1px solid #059669"
              }}>
                <p style={{ fontSize: "0.75rem", color: "white", fontWeight: "600", textAlign: "center" }}>
                  Project Completed! ??
                </p>
              </div>
              
              <div className="space-y-2">
                <button 
                  className="btn-primary" 
                  style={{ width: "100%", fontSize: "0.875rem", padding: "8px 16px" }}
                  onClick={() => alert("Converting remaining pGBT to ePT")}
                >
                  Convert to ePT
                </button>
                <button 
                  style={{
                    width: "100%",
                    backgroundColor: "#10b981",
                    color: "white",
                    fontWeight: "600",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = "#059669"}
                  onMouseOut={(e) => e.target.style.backgroundColor = "#10b981"}
                  onClick={() => alert("Claiming profits: 0.55 grams GBT")}
                >
                  Claim Profits (0.55g)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default App;




