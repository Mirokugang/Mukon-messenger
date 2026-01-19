import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { io, Socket } from 'socket.io-client';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import {
  getUserProfilePDA,
  getWalletDescriptorPDA,
  createRegisterInstruction,
  createInviteInstruction,
  createAcceptInvitationInstruction,
  createRejectInvitationInstruction,
  buildTransaction,
  deserializeWalletDescriptor,
} from '../utils/transactions';
import { deriveEncryptionKeypair } from '../utils/encryption';
import type { WalletContextType } from './WalletContext';

// Backend URL - use actual host IP for physical device
const BACKEND_URL = 'http://192.168.1.33:3001';

export interface Contact {
  publicKey: PublicKey;
  displayName?: string;
  encryptionPublicKey?: Uint8Array;
  status: 'pending' | 'accepted' | 'rejected';
}

interface Profile {
  displayName: string;
  avatarUrl?: string | null;
  publicKey: PublicKey;
  encryptionPublicKey?: string;
}

interface MessengerContextType {
  connection: Connection;
  socket: Socket | null;
  profile: Profile | null;
  contacts: Contact[];
  messages: Map<string, any[]>;
  unreadCounts: Map<string, number>;
  loading: boolean;
  encryptionReady: boolean;
  register: (displayName: string) => Promise<string | null>;
  updateProfile: (displayName: string, avatarUrl?: string) => Promise<string>;
  invite: (inviteePubkey: PublicKey) => Promise<string>;
  acceptInvitation: (inviterPubkey: PublicKey) => Promise<string>;
  rejectInvitation: (inviterPubkey: PublicKey) => Promise<string>;
  deleteContact: (contactPubkey: PublicKey) => Promise<string>;
  sendMessage: (conversationId: string, content: string, recipientPubkey: PublicKey) => Promise<void>;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  decryptConversationMessage: (encrypted: string, nonce: string, senderPubkey: PublicKey, recipientPubkey: PublicKey) => string | null;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  loadContacts: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

const MessengerContext = createContext<MessengerContextType | null>(null);

export const useMessenger = () => {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error('useMessenger must be used within MessengerProvider');
  }
  return context;
};

export const MessengerProvider: React.FC<{ children: React.ReactNode; wallet: WalletContextType | null; cluster?: string }> = ({
  children,
  wallet,
  cluster = 'devnet',
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Map<string, any[]>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [encryptionKeys, setEncryptionKeys] = useState<nacl.BoxKeyPair | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const derivingKeys = useRef(false);

  const connection = useMemo(
    () =>
      new Connection(
        cluster === 'devnet'
          ? 'https://api.devnet.solana.com'
          : 'http://localhost:8899',
        'confirmed'
      ),
    [cluster]
  );

  // Derive encryption keys from signature obtained during wallet connect
  useEffect(() => {
    if (!wallet?.publicKey) return;
    if (encryptionKeys) return; // Already have keys

    // Check for signature from WalletProvider's connect()
    const signature = (window as any).__mukonEncryptionSignature;
    if (!signature) {
      console.warn('⚠️ No encryption signature available yet');
      return;
    }

    try {
      console.log('🔐 Deriving encryption keypair from signature...');
      const keypair = deriveEncryptionKeypair(signature);
      setEncryptionKeys(keypair);
      setEncryptionReady(true);
      console.log('✅ Encryption keypair derived');

      // DON'T delete signature - other components might need it
    } catch (error) {
      console.error('❌ Failed to derive encryption keys:', error);
    }
  }, [wallet?.publicKey, encryptionKeys]);

  // Initialize socket connection (ONE instance for entire app)
  useEffect(() => {
    if (!wallet?.publicKey) return;

    console.log('🔌 Connecting to backend:', BACKEND_URL);

    // Test basic HTTP connectivity first
    fetch(`${BACKEND_URL}/health`)
      .then(res => res.json())
      .then(data => console.log('✅ Backend HTTP reachable:', data))
      .catch(err => console.error('❌ Backend HTTP unreachable:', err.message));

    const newSocket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
      upgrade: false,
      rememberUpgrade: false,
    });

    newSocket.on('connect', async () => {
      console.log('✅ Connected to backend');

      try {
        const message = `Authenticate ${newSocket.id}`;
        const signature = await wallet.signMessage!(Buffer.from(message, 'utf8'));

        newSocket.emit('authenticate', {
          publicKey: wallet.publicKey!.toBase58(),
          signature: bs58.encode(signature),
        });
      } catch (error) {
        console.error('❌ Failed to authenticate:', error);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚠️  Disconnected from backend:', reason);
    });

    newSocket.on('authenticated', (data: any) => {
      if (data.success) {
        console.log('Authenticated with backend');
      } else {
        console.error('Authentication failed:', data.error);
      }
    });

    newSocket.on('new_message', (message: any) => {
      console.log('Received new_message event:', message);
      if (message.conversationId) {
        setMessages((prev) => {
          const updated = new Map(prev);
          const conversationMessages = updated.get(message.conversationId) || [];

          // Check if message already exists (avoid duplicates)
          const exists = conversationMessages.some(
            (msg: any) =>
              msg.id === message.id ||
              (msg.encrypted && message.encrypted &&
               msg.encrypted === message.encrypted &&
               msg.nonce === message.nonce &&
               msg.sender === message.sender) ||
              (msg.content && message.content &&
               msg.content === message.content &&
               Math.abs(msg.timestamp - message.timestamp) < 5000)
          );

          if (!exists) {
            updated.set(message.conversationId, [...conversationMessages, message]);

            // Increment unread count if not from current user and not in active conversation
            setActiveConversation((activeConv) => {
              setUnreadCounts((prevUnread) => {
                if (message.sender !== wallet?.publicKey?.toBase58() &&
                    message.conversationId !== activeConv) {
                  const newUnread = new Map(prevUnread);
                  newUnread.set(
                    message.conversationId,
                    (newUnread.get(message.conversationId) || 0) + 1
                  );
                  return newUnread;
                }
                return prevUnread;
              });
              return activeConv;
            });
          }

          return updated;
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [wallet?.publicKey]);

  // Register function
  const register = async (displayName: string) => {
    if (!wallet?.publicKey || !wallet.signTransaction || !wallet.signMessage) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const userProfile = getUserProfilePDA(wallet.publicKey);
      const accountInfo = await connection.getAccountInfo(userProfile);

      if (accountInfo) {
        console.log('User already registered');
        return null;
      }

      if (!encryptionKeys) {
        throw new Error('Encryption keys not available - please reconnect wallet');
      }
      console.log('Using existing encryption keys for registration');

      console.log('Creating register instruction for:', displayName);
      const instruction = createRegisterInstruction(
        wallet.publicKey,
        displayName,
        encryptionKeys.publicKey
      );

      console.log('Building transaction...');
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      console.log('Transaction built');

      console.log('Signing transaction with wallet...');
      const signedTransaction = await wallet.signTransaction(transaction);
      console.log('Transaction signed');

      console.log('Sending transaction...');
      const txSignature = await connection.sendTransaction(signedTransaction);
      console.log('Transaction sent, signature:', txSignature);

      console.log('Confirming transaction...');
      await connection.confirmTransaction(txSignature, 'confirmed');
      console.log('Transaction confirmed!');

      setProfile({ displayName, publicKey: wallet.publicKey });
      setEncryptionReady(true);
      return txSignature;
    } catch (error) {
      console.error('Failed to register:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Other functions (updateProfile, invite, etc.)
  const updateProfile = async (displayName: string, avatarUrl?: string) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      // Implementation here - similar to register
      throw new Error('Not implemented yet');
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const invite = async (inviteePubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createInviteInstruction(wallet.publicKey, inviteePubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();
      return txSignature;
    } catch (error) {
      console.error('Failed to invite:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (inviterPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createAcceptInvitationInstruction(wallet.publicKey, inviterPubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();
      return txSignature;
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectInvitation = async (inviterPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createRejectInvitationInstruction(wallet.publicKey, inviterPubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();
      return txSignature;
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (contactPubkey: PublicKey) => {
    return rejectInvitation(contactPubkey);
  };

  const sendMessage = async (conversationId: string, content: string, recipientPubkey: PublicKey) => {
    if (!wallet?.publicKey || !socket) throw new Error('Not ready');
    if (!encryptionKeys) throw new Error('Encryption keys not available');

    try {
      const recipient = contacts.find(c => c.publicKey.equals(recipientPubkey));
      if (!recipient?.encryptionPublicKey) {
        throw new Error('Recipient encryption key not found');
      }

      console.log('🔒 Encrypting message with NaCl box...');

      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const messageBytes = new TextEncoder().encode(content);

      const encrypted = nacl.box(
        messageBytes,
        nonce,
        recipient.encryptionPublicKey,
        encryptionKeys.secretKey
      );

      const timestamp = Date.now();
      const encryptedBase64 = Buffer.from(encrypted).toString('base64');
      const nonceBase64 = Buffer.from(nonce).toString('base64');

      socket.emit('send_message', {
        conversationId,
        encrypted: encryptedBase64,
        nonce: nonceBase64,
        sender: wallet.publicKey.toBase58(),
        timestamp,
      });

      console.log('✅ Encrypted message sent via socket');

      // Optimistic update
      setMessages((prev) => {
        const updated = new Map(prev);
        const conversationMessages = updated.get(conversationId) || [];
        updated.set(conversationId, [
          ...conversationMessages,
          {
            id: `temp-${timestamp}`,
            conversationId,
            sender: wallet.publicKey!.toBase58(),
            content,
            encrypted: encryptedBase64,
            nonce: nonceBase64,
            timestamp,
          },
        ]);
        return updated;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const joinConversation = (conversationId: string) => {
    if (socket) {
      socket.emit('join_conversation', { conversationId });
      setActiveConversation(conversationId);
      setUnreadCounts((prev) => {
        const updated = new Map(prev);
        updated.delete(conversationId);
        return updated;
      });
      console.log('Joining conversation:', conversationId);
    }
  };

  const leaveConversation = (conversationId: string) => {
    if (socket) {
      socket.emit('leave_conversation', { conversationId });
      setActiveConversation(null);
      console.log('Leaving conversation:', conversationId);
    }
  };

  const decryptConversationMessage = (
    encrypted: string,
    nonce: string,
    senderPubkey: PublicKey,
    recipientPubkey: PublicKey
  ): string | null => {
    if (!wallet?.publicKey || !encryptionKeys) return null;

    try {
      const otherPersonPubkey = senderPubkey.equals(wallet.publicKey)
        ? recipientPubkey
        : senderPubkey;

      const otherPerson = contacts.find(c => c.publicKey.equals(otherPersonPubkey));
      if (!otherPerson?.encryptionPublicKey) {
        console.error('Conversation partner encryption key not found in contacts');
        return '[Encryption key not found]';
      }

      const encryptedBytes = Buffer.from(encrypted, 'base64');
      const nonceBytes = Buffer.from(nonce, 'base64');

      const decrypted = nacl.box.open(
        encryptedBytes,
        nonceBytes,
        otherPerson.encryptionPublicKey,
        encryptionKeys.secretKey
      );

      if (!decrypted) {
        console.error('Failed to decrypt message');
        return '[Unable to decrypt]';
      }

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return '[Decryption failed]';
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (!wallet?.publicKey || !wallet.signMessage) return;

    try {
      const message = `Get messages from ${conversationId}`;
      const signature = await wallet.signMessage(Buffer.from(message, 'utf8'));
      const signatureB58 = bs58.encode(signature);

      const url = `${BACKEND_URL}/messages/${conversationId}?sender=${wallet.publicKey.toBase58()}&signature=${encodeURIComponent(signatureB58)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📜 Loaded ${data.messages.length} messages from backend`);

      setMessages((prev) => {
        const updated = new Map(prev);
        updated.set(conversationId, data.messages);
        return updated;
      });
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
    }
  };

  const loadContacts = async () => {
    if (!wallet?.publicKey) return;

    try {
      const descriptorPDA = getWalletDescriptorPDA(wallet.publicKey);
      const accountInfo = await connection.getAccountInfo(descriptorPDA);

      if (!accountInfo) {
        setContacts([]);
        return;
      }

      const descriptor = deserializeWalletDescriptor(accountInfo.data);
      console.log('Found', descriptor.peers.length, 'peers');

      const contactsWithKeys = await Promise.all(
        descriptor.peers
          .filter(peer => peer.status === 'Accepted')
          .map(async (peer) => {
            const peerProfilePDA = getUserProfilePDA(peer.pubkey);
            const peerAccountInfo = await connection.getAccountInfo(peerProfilePDA);

            if (peerAccountInfo) {
              const data = peerAccountInfo.data;
              let offset = 8 + 32;
              const displayNameLength = data.readUInt32LE(offset);
              offset += 4 + displayNameLength;
              const avatarUrlLength = data.readUInt32LE(offset);
              offset += 4 + avatarUrlLength;
              const encryptionPublicKey = data.slice(offset, offset + 32);

              console.log(
                `Loaded encryption key for ${peer.pubkey.toBase58().slice(0, 8)}...: ${Buffer.from(encryptionPublicKey).toString('hex').slice(0, 16)}...`
              );

              return {
                publicKey: peer.pubkey,
                displayName: '',
                encryptionPublicKey,
                status: 'accepted' as const,
              };
            }

            return {
              publicKey: peer.pubkey,
              displayName: '',
              status: 'accepted' as const,
            };
          })
      );

      console.log('Loaded peers with encryption keys:', contactsWithKeys.filter(c => c.encryptionPublicKey).length);
      setContacts(contactsWithKeys);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const loadProfile = async () => {
    if (!wallet?.publicKey) return;

    try {
      const userProfile = getUserProfilePDA(wallet.publicKey);
      const accountInfo = await connection.getAccountInfo(userProfile);

      if (!accountInfo) {
        console.log('No profile found, user needs to register');
        setProfile(null);
        return;
      }

      if (!encryptionKeys) {
        console.warn('⚠️ Encryption keys not yet available, will retry when ready');
        setProfile(null);
        return;
      }

      const data = accountInfo.data;
      let offset = 8;

      offset += 32;

      const displayNameLength = data.readUInt32LE(offset);
      offset += 4;
      const displayNameBytes = data.slice(offset, offset + displayNameLength);
      const displayName = Buffer.from(displayNameBytes).toString('utf8');
      offset += displayNameLength;

      const avatarUrlLength = data.readUInt32LE(offset);
      offset += 4;
      const avatarUrlBytes = data.slice(offset, offset + avatarUrlLength);
      const avatarUrl = avatarUrlLength > 0 ? Buffer.from(avatarUrlBytes).toString('utf8') : null;
      offset += avatarUrlLength;

      const encryptionPublicKeyBytes = data.slice(offset, offset + 32);
      const encryptionPublicKey = Buffer.from(encryptionPublicKeyBytes).toString('hex');

      console.log('Profile loaded:', { displayName, avatarUrl, encryptionPublicKey });

      setProfile({
        displayName,
        avatarUrl: avatarUrl || null,
        publicKey: wallet.publicKey,
        encryptionPublicKey,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile(null);
    }
  };

  // Load profile and contacts when encryption keys are available
  useEffect(() => {
    if (wallet?.publicKey && encryptionKeys) {
      loadProfile();
      loadContacts();
    }
  }, [wallet?.publicKey, encryptionKeys]);

  const value: MessengerContextType = {
    connection,
    socket,
    profile,
    contacts,
    messages,
    unreadCounts,
    loading,
    encryptionReady,
    register,
    updateProfile,
    invite,
    acceptInvitation,
    rejectInvitation,
    deleteContact,
    sendMessage,
    joinConversation,
    leaveConversation,
    decryptConversationMessage,
    loadConversationMessages,
    loadContacts,
    loadProfile,
  };

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
};
