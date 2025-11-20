import { useState, useEffect } from "react";
import { 
  isConnected, 
  getPublicKey, 
  getNetwork,
  signTransaction 
} from "@stellar/freighter-api";

export interface WalletState {
  connected: boolean;
  publicKey: string;
  networkPassphrase: string;
  loading: boolean;
  error: string | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: "",
    networkPassphrase: "",
    loading: false,
    error: null,
  });

  const checkConnection = async () => {
    try {
      const connected = await isConnected();
      
      if (connected) {
        const publicKey = await getPublicKey();
        const network = await getNetwork();
        
        // Convertir network a networkPassphrase
        const networkPassphrase = network === "TESTNET" 
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015";
        
        setWallet({
          connected: true,
          publicKey: publicKey,
          networkPassphrase: networkPassphrase,
          loading: false,
          error: null,
        });
        
        console.log("? Freighter already connected:", publicKey);
      }
    } catch (error: any) {
      console.log("Freighter check error:", error);
    }
  };

  const connect = async () => {
    console.log("?? Connect button clicked!");
    setWallet(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log("?? Checking if Freighter is installed...");
      
      const connected = await isConnected();
      console.log("Freighter installed:", connected);
      
      if (!connected) {
        throw new Error("Freighter wallet not installed. Please install from https://freighter.app");
      }
      
      console.log("?? Getting public key (this will trigger Freighter popup)...");
      const publicKey = await getPublicKey();
      console.log("?? Public Key:", publicKey);
      
      const network = await getNetwork();
      console.log("?? Network:", network);
      
      const networkPassphrase = network === "TESTNET" 
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";
      
      setWallet({
        connected: true,
        publicKey: publicKey,
        networkPassphrase: networkPassphrase,
        loading: false,
        error: null,
      });
      
      console.log("? Wallet connected successfully!");
    } catch (error: any) {
      console.error("? Connect error:", error);
      
      let errorMessage = error.message || "Failed to connect wallet";
      
      // Mensajes específicos según el error
      if (error.message?.includes("User declined access")) {
        errorMessage = "Access denied by user";
      } else if (error.message?.includes("Freighter is not installed")) {
        errorMessage = "Please install Freighter wallet extension";
      }
      
      setWallet(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  };

  const disconnect = () => {
    console.log("?? Disconnecting wallet");
    setWallet({
      connected: false,
      publicKey: "",
      networkPassphrase: "",
      loading: false,
      error: null,
    });
  };

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted) {
        await checkConnection();
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, []);

  return {
    ...wallet,
    connect,
    disconnect,
  };
}

