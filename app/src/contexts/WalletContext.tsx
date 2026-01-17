import React, { createContext, useContext, useState, useEffect } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import nacl from 'tweetnacl';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

/**
 * Simple wallet provider for development/testing
 * TODO: Replace with @solana-mobile/wallet-adapter-mobile for production
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Auto-load saved wallet on mount
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const saved = await AsyncStorage.getItem('dev_wallet');
      if (saved) {
        const secretKey = Uint8Array.from(JSON.parse(saved));
        const kp = Keypair.fromSecretKey(secretKey);
        setKeypair(kp);
        setConnected(true);
      }
    } catch (error) {
      console.error('Failed to load wallet:', error);
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      let kp = keypair;

      if (!kp) {
        // Generate new dev wallet
        kp = Keypair.generate();

        // Save it
        await AsyncStorage.setItem(
          'dev_wallet',
          JSON.stringify(Array.from(kp.secretKey))
        );

        setKeypair(kp);
      }

      setConnected(true);
      console.log('Wallet connected:', kp.publicKey.toBase58());
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setKeypair(null);
    setConnected(false);
    await AsyncStorage.removeItem('dev_wallet');
  };

  const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (!keypair) throw new Error('Wallet not connected');
    return nacl.sign.detached(message, keypair.secretKey);
  };

  const signTransaction = async (transaction: any): Promise<any> => {
    if (!keypair) throw new Error('Wallet not connected');
    transaction.sign(keypair);
    return transaction;
  };

  const value: WalletContextType = {
    publicKey: keypair?.publicKey || null,
    connected,
    connecting,
    connect,
    disconnect,
    signMessage,
    signTransaction,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
