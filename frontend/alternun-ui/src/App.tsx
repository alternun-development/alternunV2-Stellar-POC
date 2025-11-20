import React, { useState } from "react";
import "./App.css";
import { useWallet } from "./useWallet";
import { MintTab } from "./MintTab";
import { DashboardTab } from "./DashboardTab";
import { AdminTab } from "./AdminTab";
import { ProjectsTab } from "./ProjectsTab";

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




export default App;






