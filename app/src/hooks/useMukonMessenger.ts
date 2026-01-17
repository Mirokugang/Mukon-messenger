import { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import io, { Socket } from 'socket.io-client';
import { encryptMessage, decryptMessage, getChatHash, truncateAddress } from '../utils/encryption';
import {
  createRegisterInstruction,
  createInviteInstruction,
  createAcceptInstruction,
  createRejectInstruction,
  buildAndSendTransaction,
  getWalletDescriptorPDA,
  getUserProfilePDA,
} from '../utils/transactions';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

const PROGRAM_ID = new PublicKey('89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr');
const BACKEND_URL = 'http://localhost:3001';

interface Wallet {
  publicKey: PublicKey | null;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
}

export function useMukonMessenger(wallet: Wallet | null, cluster: string = 'devnet') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Map<string, any[]>>(new Map());
  const [contacts, setContacts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Initialize connection
  const connection = useMemo(
    () => new Connection(
      cluster === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'http://localhost:8899',
      'confirmed'
    ),
    [cluster]
  );

  // No Anchor program needed - we build transactions manually

  // Initialize socket connection
  useEffect(() => {
    if (!wallet?.publicKey) return;

    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', async () => {
      console.log('Connected to backend');

      try {
        const message = `Authenticate ${newSocket.id}`;
        const signature = await wallet.signMessage(Buffer.from(message, 'utf8'));

        newSocket.emit('authenticate', {
          publicKey: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString('base64'),
        });
      } catch (error) {
        console.error('Failed to authenticate:', error);
      }
    });

    newSocket.on('authenticated', (data: any) => {
      if (data.success) {
        console.log('Authenticated with backend');
      } else {
        console.error('Authentication failed:', data.error);
      }
    });

    newSocket.on('new_message', (message: any) => {
      setMessages((prev) => {
        const updated = new Map(prev);
        const conversationMessages = updated.get(message.conversationId) || [];
        updated.set(message.conversationId, [...conversationMessages, message]);
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [wallet]);

  /**
   * Register a new user with display name
   */
  const register = async (displayName: string) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createRegisterInstruction(wallet.publicKey, displayName);

      const signature = await buildAndSendTransaction(
        connection,
        wallet.publicKey,
        [instruction],
        wallet.signTransaction
      );

      console.log('Registered user:', displayName, 'TX:', signature);

      setProfile({ displayName, publicKey: wallet.publicKey });
      return signature;
    } catch (error) {
      console.error('Failed to register:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update user profile
   * TODO: Implement updateProfile instruction builder
   */
  const updateProfile = async (displayName?: string, avatarUrl?: string) => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      // TODO: Create updateProfile instruction and send transaction
      console.warn('updateProfile not yet implemented with manual transactions');

      if (displayName) {
        setProfile((prev: any) => ({ ...prev, displayName }));
      }

      return 'placeholder-signature';
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Invite a contact
   */
  const invite = async (contactPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const chatHash = getChatHash(wallet.publicKey, contactPubkey);

      const instruction = createInviteInstruction(
        wallet.publicKey,
        contactPubkey,
        chatHash
      );

      const signature = await buildAndSendTransaction(
        connection,
        wallet.publicKey,
        [instruction],
        wallet.signTransaction
      );

      console.log('Sent invitation to:', contactPubkey.toBase58(), 'TX:', signature);
      return signature;
    } catch (error) {
      console.error('Failed to invite:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Accept an invitation
   */
  const acceptInvitation = async (peerPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createAcceptInstruction(wallet.publicKey, peerPubkey);

      const signature = await buildAndSendTransaction(
        connection,
        wallet.publicKey,
        [instruction],
        wallet.signTransaction
      );

      console.log('Accepted invitation from:', peerPubkey.toBase58(), 'TX:', signature);
      await loadContacts(); // Refresh contacts
      return signature;
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reject an invitation
   */
  const rejectInvitation = async (peerPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createRejectInstruction(wallet.publicKey, peerPubkey);

      const signature = await buildAndSendTransaction(
        connection,
        wallet.publicKey,
        [instruction],
        wallet.signTransaction
      );

      console.log('Rejected invitation from:', peerPubkey.toBase58(), 'TX:', signature);
      await loadContacts();
      return signature;
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send an encrypted message
   */
  const sendMessage = async (
    conversationId: string,
    content: string,
    recipientPubkey: PublicKey
  ) => {
    if (!wallet?.publicKey || !socket) throw new Error('Not ready');

    try {
      // Derive encryption keys from wallet signature
      const message = 'Sign to derive encryption keys for Mukon Messenger';
      const signature = await wallet.signMessage(Buffer.from(message, 'utf8'));
      const { secretKey } = nacl.box.keyPair.fromSecretKey(signature.slice(0, 32));

      // TODO: Get recipient's encryption public key (would be stored on-chain or derived)
      // For now, using their wallet pubkey as placeholder
      const { encrypted, nonce } = encryptMessage(
        content,
        recipientPubkey.toBytes(),
        secretKey
      );

      // Send via socket
      socket.emit('send_message', {
        conversationId,
        encrypted,
        nonce,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  /**
   * Load contacts from chain
   * TODO: Implement account deserialization
   */
  const loadContacts = async () => {
    if (!wallet?.publicKey) return;

    setLoading(true);
    try {
      const walletDescriptor = getWalletDescriptorPDA(wallet.publicKey);

      // TODO: Fetch and deserialize WalletDescriptor account manually
      // const accountInfo = await connection.getAccountInfo(walletDescriptor);
      // const descriptorAccount = deserializeWalletDescriptor(accountInfo.data);

      console.warn('loadContacts not yet implemented with manual deserialization');

      // Placeholder: empty contacts list
      setContacts([]);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load user profile
   * TODO: Implement account deserialization
   */
  const loadProfile = async () => {
    if (!wallet?.publicKey) return;

    try {
      const userProfile = getUserProfilePDA(wallet.publicKey);

      // TODO: Fetch and deserialize UserProfile account manually
      // const accountInfo = await connection.getAccountInfo(userProfile);
      // const profileAccount = deserializeUserProfile(accountInfo.data);

      console.warn('loadProfile not yet implemented with manual deserialization');

      // For now, just set publicKey without display name
      setProfile({
        displayName: null,
        avatarUrl: null,
        publicKey: wallet.publicKey,
      });
    } catch (error) {
      // Profile doesn't exist yet
      console.log('No profile found, user needs to register');
    }
  };

  // Load profile and contacts on wallet connect
  useEffect(() => {
    if (wallet?.publicKey) {
      loadProfile();
      loadContacts();
    }
  }, [wallet?.publicKey]);

  return {
    connection,
    wallet,
    socket,
    profile,
    contacts,
    messages,
    loading,
    register,
    updateProfile,
    invite,
    acceptInvitation,
    rejectInvitation,
    sendMessage,
    loadContacts,
    loadProfile,
  };
}
