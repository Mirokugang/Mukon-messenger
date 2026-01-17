import React, { createContext, useContext, useState, useCallback } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

const APP_IDENTITY = {
  name: 'Mukon Messenger',
  uri: 'https://mukon.app',
  icon: 'icon.png',
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await transact(async (wallet) => {
        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        const pubkey = new PublicKey(authResult.accounts[0].address);
        setPublicKey(pubkey);
        setConnected(true);
        console.log('Wallet connected:', pubkey.toBase58());
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await transact(async (wallet) => {
        await wallet.deauthorize();
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setPublicKey(null);
      setConnected(false);
    }
  }, []);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('Wallet not connected');

    return await transact(async (wallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });

      const signedMessages = await wallet.signMessages({
        addresses: [authResult.accounts[0].address],
        payloads: [message],
      });

      return signedMessages[0];
    });
  }, [publicKey]);

  const signTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    return await transact(async (wallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const signedTxs = await wallet.signTransactions({
        transactions: [serialized],
      });

      if (transaction instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(signedTxs[0]);
      } else {
        return Transaction.from(signedTxs[0]);
      }
    });
  }, [publicKey]);

  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');

    return await transact(async (wallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const result = await wallet.signAndSendTransactions({
        transactions: [serialized],
      });

      return result.signatures[0];
    });
  }, [publicKey]);

  const value: WalletContextType = {
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
