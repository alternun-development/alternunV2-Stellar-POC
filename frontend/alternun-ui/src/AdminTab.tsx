import { useState } from "react";
import { upsertMine } from "./contractTransactions";
import { TESTNET_CONTRACTS } from "./contracts.config";

interface AdminTabProps {
  wallet: any;
}

export function AdminTab({ wallet }: AdminTabProps) {
  const [newMine, setNewMine] = useState({
    id: "",
    name: "",
    inferidos_gm: "",
    indicados_gm: "",
    medidos_gm: "",
    probables_gm: "",
    probadas_gm: ""
  });

  const [loading, setLoading] = useState(false);

  const handleMineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected) {
      alert("Please connect your wallet first");
      return;
    }

    // Validate inputs
    const mineId = parseInt(newMine.id);
    if (isNaN(mineId) || mineId < 0) {
      alert("Please enter a valid mine ID (number >= 0)");
      return;
    }

    // Convert grams to contract format (grams * 1000)
    const inferidos = Math.floor(parseFloat(newMine.inferidos_gm) * 1000);
    const indicados = Math.floor(parseFloat(newMine.indicados_gm || "0") * 1000);
    const medidos = Math.floor(parseFloat(newMine.medidos_gm || "0") * 1000);
    const probables = Math.floor(parseFloat(newMine.probables_gm || "0") * 1000);
    const probadas = Math.floor(parseFloat(newMine.probadas_gm || "0") * 1000);

    if (!confirm(`Register mine "${newMine.name}" with ID ${mineId}?`)) {
      return;
    }

    setLoading(true);
    console.log("?? Registering mine:", newMine);

    const result = await upsertMine(
      wallet.publicKey,
      mineId,
      inferidos,
      indicados,
      medidos,
      probables,
      probadas,
      true // enabled
    );

    setLoading(false);

    if (result.success) {
      alert(`? Mine registered successfully!\n\nMine ID: ${mineId}\nName: ${newMine.name}`);
      // Reset form
      setNewMine({
        id: "",
        name: "",
        inferidos_gm: "",
        indicados_gm: "",
        medidos_gm: "",
        probables_gm: "",
        probadas_gm: ""
      });
    } else {
      alert(`? Failed to register mine\n\n${result.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-alternun mb-4">Administration Panel</h2>
        <p className="text-gray" style={{ fontSize: "1.125rem", maxWidth: "32rem", margin: "0 auto" }}>
          Manage the Alternun ecosystem: register new mines and monitor contract status.
        </p>
      </div>

      {/* Contract Status */}
      <div className="card" style={{ background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)" }}>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <span style={{ marginRight: "0.75rem" }}>??</span>
          Contract Status
        </h3>
        <div className="grid-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[
            { name: "Oracle Mock", address: TESTNET_CONTRACTS.ORACLE_MOCK },
            { name: "Treasury", address: TESTNET_CONTRACTS.TREASURY },
            { name: "GBT Token", address: TESTNET_CONTRACTS.GBT_TOKEN },
            { name: "GBT Minter", address: TESTNET_CONTRACTS.GBT_MINTER },
            { name: "Project Vaults", address: TESTNET_CONTRACTS.PROJECT_VAULTS },
            { name: "pGBT Token", address: TESTNET_CONTRACTS.PGBT_TOKEN },
            { name: "ePT Token", address: TESTNET_CONTRACTS.EPT_TOKEN }
          ].map((contract) => (
            <div key={contract.name} className="preview-card">
              <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#d1d5db" }}>{contract.name}</span>
                <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
              </div>
              <p style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "#6b7280", wordBreak: "break-all" }}>
                {contract.address.substring(0, 12)}...
              </p>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#1e40af", borderRadius: "8px", border: "1px solid #3b82f6" }}>
          <p className="font-bold text-white">POC Status: Fully Functional on Testnet</p>
          <p style={{ color: "#bfdbfe", fontSize: "0.875rem" }}>All 7 contracts deployed and operational. System validated end-to-end.</p>
        </div>
      </div>

      {/* Register Mine Form */}
      <div className="card" style={{ background: "linear-gradient(135deg, #92400e 0%, #78350f 100%)", border: "1px solid #f59e0b" }}>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <span style={{ marginRight: "0.75rem" }}>??</span>
          Register New Mine
        </h3>
        
        <form onSubmit={handleMineSubmit} className="space-y-4">
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            <div>
              <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Mine ID *
              </label>
              <input
                type="number"
                value={newMine.id}
                onChange={(e) => setNewMine({...newMine, id: e.target.value})}
                className="input-field"
                placeholder="2"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Mine Name *
              </label>
              <input
                type="text"
                value={newMine.name}
                onChange={(e) => setNewMine({...newMine, name: e.target.value})}
                className="input-field"
                placeholder="e.g., AL-2 Mine"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="text-white font-semibold" style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              Inferred Resources (grams) *
            </label>
            <input
              type="number"
              step="0.001"
              value={newMine.inferidos_gm}
              onChange={(e) => setNewMine({...newMine, inferidos_gm: e.target.value})}
              className="input-field"
              placeholder="500000"
              required
              disabled={loading}
            />
            <p style={{ fontSize: "0.75rem", color: "#fef3c7", marginTop: "0.25rem" }}>
              Weight: 15% for capacity calculation
            </p>
          </div>
          
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Indicated (grams)
              </label>
              <input
                type="number"
                step="0.001"
                value={newMine.indicados_gm}
                onChange={(e) => setNewMine({...newMine, indicados_gm: e.target.value})}
                className="input-field"
                style={{ fontSize: "0.875rem" }}
                placeholder="0"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 30%</p>
            </div>
            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Measured (grams)
              </label>
              <input
                type="number"
                step="0.001"
                value={newMine.medidos_gm}
                onChange={(e) => setNewMine({...newMine, medidos_gm: e.target.value})}
                className="input-field"
                style={{ fontSize: "0.875rem" }}
                placeholder="0"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 60%</p>
            </div>
            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Probable (grams)
              </label>
              <input
                type="number"
                step="0.001"
                value={newMine.probables_gm}
                onChange={(e) => setNewMine({...newMine, probables_gm: e.target.value})}
                className="input-field"
                style={{ fontSize: "0.875rem" }}
                placeholder="0"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 50%</p>
            </div>
            <div>
              <label className="text-white" style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                Proven (grams)
              </label>
              <input
                type="number"
                step="0.001"
                value={newMine.probadas_gm}
                onChange={(e) => setNewMine({...newMine, probadas_gm: e.target.value})}
                className="input-field"
                style={{ fontSize: "0.875rem" }}
                placeholder="0"
                disabled={loading}
              />
              <p style={{ fontSize: "0.65rem", color: "#fde68a", marginTop: "0.25rem" }}>Weight: 70%</p>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: "100%", opacity: loading || !wallet.connected ? 0.6 : 1 }}
            disabled={loading || !wallet.connected}
          >
            {loading ? "Registering..." : wallet.connected ? "Register Mine with NI 43-101" : "Connect Wallet"}
          </button>

          {!wallet.connected && (
            <p style={{ fontSize: "0.75rem", color: "#fef3c7", textAlign: "center" }}>
              Connect your wallet to register mines
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

