import React, { createContext, useContext, useState, useCallback } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { toUint8Array } from 'js-base64';

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
  const [authToken, setAuthToken] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const encryptionSignature = await transact(async (wallet) => {
        console.log('Starting wallet authorization...');

        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        console.log('Authorization successful, processing result...');
        console.log('Auth result accounts:', authResult.accounts?.length);
        console.log('Auth token:', authResult.auth_token);

        // Store auth token for reauthorization
        setAuthToken(authResult.auth_token);

        // MWA returns address as base64-encoded string
        // Decode it to Uint8Array, then create PublicKey
        const base64Address = authResult.accounts[0].address;
        console.log('Base64 address:', base64Address);

        const publicKeyBytes = toUint8Array(base64Address);
        console.log('Public key bytes length:', publicKeyBytes.length);

        const pubkey = new PublicKey(publicKeyBytes);
        console.log('PublicKey created successfully:', pubkey.toBase58());

        setPublicKey(pubkey);
        setConnected(true);
        console.log('Wallet connected:', pubkey.toBase58());

        // CRITICAL: Derive encryption keys IN THE SAME transact() session
        console.log('🔐 Deriving encryption keypair (in same session)...');
        const message = Buffer.from('Sign this message to derive your encryption keys for Mukon Messenger', 'utf8');
        const signedMessages = await wallet.signMessages({
          addresses: [authResult.accounts[0].address],
          payloads: [message],
        });
        console.log('✅ Encryption signature obtained');
        return signedMessages[0];
      });

      // Store encryption signature for useMukonMessenger to use
      (window as any).__mukonEncryptionSignature = encryptionSignature;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      console.error('Error stack:', error.stack);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken ?? undefined });
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setPublicKey(null);
      setConnected(false);
      setAuthToken(null);
    }
  }, [authToken]);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('Wallet not connected');

    return await transact(async (wallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
        auth_token: authToken ?? undefined,
      });

      const signedMessages = await wallet.signMessages({
        addresses: [authResult.accounts[0].address],
        payloads: [message],
      });

      return signedMessages[0];
    });
  }, [publicKey, authToken]);

  const signTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    return await transact(async (wallet) => {
      await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
        auth_token: authToken ?? undefined,
      });

      // Pass the transaction object directly to signTransactions
      const signedTxs = await wallet.signTransactions({
        transactions: [transaction],
      });

      // wallet.signTransactions returns the signed transactions
      return signedTxs[0];
    });
  }, [publicKey, authToken]);

  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    console.log('signAndSendTransaction called with:', transaction);
    console.log('Transaction type:', transaction?.constructor?.name);

    if (!publicKey) throw new Error('Wallet not connected');

    // CRITICAL: Serialize BEFORE passing to transact() to preserve methods
    const serialized = transaction instanceof VersionedTransaction
      ? transaction.serialize()
      : transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

    console.log('Serialized transaction, length:', serialized.length);

    return await transact(async (wallet) => {
      // Silently reauthorize using stored auth token
      await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
        auth_token: authToken ?? undefined,
      });

      console.log('Sending transaction to wallet...');
      const result = await wallet.signAndSendTransactions({
        transactions: [serialized],
      });

      console.log('Transaction result:', result);
      return result.signatures[0];
    });
  }, [publicKey, authToken]);

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
