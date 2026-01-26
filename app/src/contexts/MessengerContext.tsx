import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { io, Socket } from 'socket.io-client';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import {
  getUserProfilePDA,
  getWalletDescriptorPDA,
  getGroupPDA,
  getGroupInvitePDA,
  createRegisterInstruction,
  createUpdateProfileInstruction,
  createCloseProfileInstruction,
  createInviteInstruction,
  createAcceptInvitationInstruction,
  createRejectInvitationInstruction,
  createBlockInstruction,
  createUnblockInstruction,
  createCreateGroupInstruction,
  createUpdateGroupInstruction,
  createInviteToGroupInstruction,
  createAcceptGroupInviteInstruction,
  createRejectGroupInviteInstruction,
  createLeaveGroupInstruction,
  createKickMemberInstruction,
  buildTransaction,
  deserializeWalletDescriptor,
  deserializeGroup,
  deserializeGroupInvite,
  type Group,
  type GroupInvite,
  type TokenGate,
} from '../utils/transactions';
import { deriveEncryptionKeypair, getChatHash } from '../utils/encryption';
import type { WalletContextType } from './WalletContext';

// Backend URL - use actual host IP for physical device
const BACKEND_URL = 'http://192.168.68.57:3001';

export interface Contact {
  publicKey: PublicKey;
  displayName?: string;
  encryptionPublicKey?: Uint8Array;
  state: 'Invited' | 'Requested' | 'Accepted' | 'Rejected' | 'Blocked';
  avatarUrl?: string;
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
  // DM methods
  register: (displayName: string, avatarData?: string) => Promise<string | null>;
  updateProfile: (displayName: string, avatarType?: 'Emoji' | 'Nft', avatarData?: string) => Promise<string>;
  closeProfile: () => Promise<string>;
  invite: (inviteePubkey: PublicKey) => Promise<string>;
  acceptInvitation: (inviterPubkey: PublicKey) => Promise<string>;
  rejectInvitation: (inviterPubkey: PublicKey) => Promise<string>;
  deleteContact: (contactPubkey: PublicKey) => Promise<string>;
  blockContact: (contactPubkey: PublicKey) => Promise<string>;
  unblockContact: (contactPubkey: PublicKey) => Promise<string>;
  sendMessage: (conversationId: string, content: string, recipientPubkey: PublicKey, replyToMessageId?: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string, deleteForBoth: boolean) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  decryptConversationMessage: (encrypted: string, nonce: string, senderPubkey: PublicKey, recipientPubkey: PublicKey) => string | null;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  loadContacts: () => Promise<void>;
  loadProfile: () => Promise<void>;
  // Group methods
  groups: Group[];
  groupInvites: GroupInvite[];
  groupMessages: Map<string, any[]>;
  createGroup: (name: string, tokenGate?: TokenGate) => Promise<{ groupId: Uint8Array; txSignature: string }>;
  updateGroup: (groupId: Uint8Array, name?: string, tokenGate?: TokenGate) => Promise<string>;
  inviteToGroup: (groupId: Uint8Array, inviteePubkey: PublicKey) => Promise<string>;
  acceptGroupInvite: (groupId: Uint8Array, userTokenAccount?: PublicKey) => Promise<string>;
  rejectGroupInvite: (groupId: Uint8Array) => Promise<string>;
  leaveGroup: (groupId: Uint8Array) => Promise<string>;
  kickMember: (groupId: Uint8Array, memberPubkey: PublicKey) => Promise<string>;
  sendGroupMessage: (groupId: string, content: string) => Promise<void>;
  loadGroups: () => Promise<void>;
  loadGroupInvites: () => Promise<void>;
  loadGroupMessages: (groupId: string) => Promise<void>;
  joinGroupRoom: (groupId: string) => void;
  leaveGroupRoom: (groupId: string) => void;
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
  // Group state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupMessages, setGroupMessages] = useState<Map<string, any[]>>(new Map());
  const [groupKeys, setGroupKeys] = useState<Map<string, Uint8Array>>(new Map()); // groupId -> symmetric key
  const [activeGroupRoom, setActiveGroupRoom] = useState<string | null>(null);

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
      transports: ['polling', 'websocket'], // Try polling first (works on restricted networks)
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 30000, // Increase timeout for physical device
      forceNew: true,
      autoConnect: true,
    });

    newSocket.on('connect', async () => {
      console.log('✅ Connected to backend via', newSocket.io.engine.transport.name);

      try {
        // Reuse encryption signature for socket authentication (no new popup!)
        const encryptionSig = (window as any).__mukonEncryptionSignature;
        if (!encryptionSig) {
          console.error('❌ No encryption signature available for socket auth');
          return;
        }

        // Use encryption signature as authentication proof
        newSocket.emit('authenticate', {
          publicKey: wallet.publicKey!.toBase58(),
          signature: bs58.encode(encryptionSig),
        });
        console.log('🔐 Socket authenticated with cached signature (no popup)');
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

    newSocket.on('message_deleted', ({ conversationId, messageId }) => {
      console.log('Message deleted:', conversationId, messageId);
      setMessages((prev) => {
        const updated = new Map(prev);
        const conversationMessages = updated.get(conversationId) || [];
        updated.set(conversationId, conversationMessages.filter(m => m.id !== messageId));
        return updated;
      });
    });

    newSocket.on('reaction_updated', ({ conversationId, messageId, reactions }) => {
      console.log('📨 Reaction updated:', {
        conversationId: conversationId.slice(0, 8) + '...',
        messageId,
        reactions: JSON.stringify(reactions)
      });
      setMessages((prev) => {
        const updated = new Map(prev);
        const conversationMessages = updated.get(conversationId) || [];
        console.log(`Updating message ${messageId} with reactions:`, reactions);
        const updatedMessages = conversationMessages.map(m =>
          m.id === messageId ? { ...m, reactions } : m
        );
        updated.set(conversationId, updatedMessages);
        return updated;
      });
    });

    // Group event handlers
    newSocket.on('group_message', (message: any) => {
      console.log('📨 Received group message:', message);
      if (message.groupId) {
        setGroupMessages((prev) => {
          const updated = new Map(prev);
          const groupMsgs = updated.get(message.groupId) || [];

          // Check for duplicates
          const exists = groupMsgs.some(m => m.id === message.id);
          if (!exists) {
            updated.set(message.groupId, [...groupMsgs, message]);
          }

          return updated;
        });
      }
    });

    newSocket.on('group_member_joined', ({ groupId, memberPubkey }) => {
      console.log('👥 Member joined group:', groupId, memberPubkey);
      // Reload groups to update member list
      // We'll trigger this in the individual screens that need it
    });

    newSocket.on('group_member_left', ({ groupId, memberPubkey }) => {
      console.log('👋 Member left group:', groupId, memberPubkey);
    });

    newSocket.on('group_member_kicked', ({ groupId, memberPubkey }) => {
      console.log('🚫 Member kicked from group:', groupId, memberPubkey);
    });

    newSocket.on('group_key_shared', ({ groupId, senderPubkey, encryptedKey, nonce }) => {
      console.log('🔑 Received group key share from:', senderPubkey);

      // Decrypt group key with our encryption keys
      if (encryptionKeys) {
        try {
          const sender = contacts.find(c => c.publicKey.toBase58() === senderPubkey);
          if (sender?.encryptionPublicKey) {
            const encryptedBytes = Buffer.from(encryptedKey, 'base64');
            const nonceBytes = Buffer.from(nonce, 'base64');

            const decryptedKey = nacl.box.open(
              encryptedBytes,
              nonceBytes,
              sender.encryptionPublicKey,
              encryptionKeys.secretKey
            );

            if (decryptedKey) {
              setGroupKeys(prev => {
                const updated = new Map(prev);
                updated.set(groupId, decryptedKey);
                return updated;
              });
              console.log('✅ Group key decrypted and stored');
            }
          }
        } catch (error) {
          console.error('❌ Failed to decrypt group key:', error);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [wallet?.publicKey]);

  // Register function
  const register = async (displayName: string, avatarData: string = '') => {
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
        avatarData,
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
  const updateProfile = async (displayName: string, avatarType?: 'Emoji' | 'Nft', avatarData?: string) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createUpdateProfileInstruction(
        wallet.publicKey,
        displayName,
        avatarType || null,
        avatarData || null,
        encryptionKeys ? Array.from(encryptionKeys.publicKey) : null
      );
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Reload profile to reflect changes
      await loadProfile();
      return txSignature;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const closeProfile = async () => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createCloseProfileInstruction(wallet.publicKey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Clear local state
      setProfile(null);
      setContacts([]);
      setMessages(new Map());
      setEncryptionReady(false);

      console.log('✅ Profile closed, account rent returned');
      return txSignature;
    } catch (error) {
      console.error('Failed to close profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const invite = async (inviteePubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      // Calculate chat hash for the conversation PDA
      const chatHash = getChatHash(wallet.publicKey, inviteePubkey);
      const instruction = createInviteInstruction(wallet.publicKey, inviteePubkey, chatHash);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();

      // Send system message for invitation
      if (socket) {
        const conversationId = Buffer.from(chatHash).toString('hex');
        const inviteMessage = {
          conversationId,
          sender: wallet.publicKey.toBase58(),
          recipient: inviteePubkey.toBase58(),
          type: 'system',
          content: `You've been invited to chat on Mukon! Accept the invitation to start messaging.`,
          timestamp: Date.now(),
        };

        socket.emit('send_message', inviteMessage);
        console.log('📨 Sent invitation system message');
      }

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

      // Send system message for acceptance
      if (socket) {
        const chatHash = getChatHash(wallet.publicKey, inviterPubkey);
        const conversationId = Buffer.from(chatHash).toString('hex');
        const acceptMessage = {
          conversationId,
          sender: wallet.publicKey.toBase58(),
          recipient: inviterPubkey.toBase58(),
          type: 'system',
          content: `Invitation accepted! You can now chat securely.`,
          timestamp: Date.now(),
        };

        socket.emit('send_message', acceptMessage);
        console.log('📨 Sent acceptance system message');
      }

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

  const blockContact = async (contactPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createBlockInstruction(wallet.publicKey, contactPubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();
      return txSignature;
    } catch (error) {
      console.error('Failed to block contact:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const unblockContact = async (contactPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createUnblockInstruction(wallet.publicKey, contactPubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadContacts();
      return txSignature;
    } catch (error) {
      console.error('Failed to unblock contact:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (conversationId: string, content: string, recipientPubkey: PublicKey, replyToMessageId?: string) => {
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
        replyTo: replyToMessageId, // Reply reference
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

  const deleteMessage = (conversationId: string, messageId: string, deleteForBoth: boolean) => {
    if (!socket) {
      console.error('Socket not connected');
      return;
    }

    if (deleteForBoth) {
      // Delete for everyone - emit to backend
      socket.emit('delete_message', { conversationId, messageId, deleteForBoth: true });
      console.log('🗑️ Deleting message for everyone:', messageId);
    } else {
      // Delete for self only - remove from local state
      setMessages((prev) => {
        const updated = new Map(prev);
        const conversationMessages = updated.get(conversationId) || [];
        updated.set(conversationId, conversationMessages.filter(m => m.id !== messageId));
        return updated;
      });
      console.log('🗑️ Deleted message locally:', messageId);
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
    if (!wallet?.publicKey) return;

    try {
      // Use cached encryption signature (no popup!)
      const encryptionSig = (window as any).__mukonEncryptionSignature;
      if (!encryptionSig) {
        console.error('No encryption signature available');
        return;
      }

      const signatureB58 = bs58.encode(encryptionSig);
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
          // Load ALL peers (not just Accepted) so we can check state in AddContactScreen
          .map(async (peer) => {
            const peerProfilePDA = getUserProfilePDA(peer.pubkey);
            const peerAccountInfo = await connection.getAccountInfo(peerProfilePDA);

            let displayName: string | undefined;
            let avatarUrl: string | undefined;
            let encryptionPublicKey: Uint8Array | undefined;

            if (peerAccountInfo) {
              const data = peerAccountInfo.data;
              let offset = 8 + 32;
              const displayNameLength = data.readUInt32LE(offset);
              offset += 4;
              displayName = data.slice(offset, offset + displayNameLength).toString('utf-8');
              offset += displayNameLength;
              const avatarUrlLength = data.readUInt32LE(offset);
              offset += 4;
              avatarUrl = data.slice(offset, offset + avatarUrlLength).toString('utf-8');
              offset += avatarUrlLength;
              encryptionPublicKey = data.slice(offset, offset + 32);

              if (peer.status === 'Accepted') {
                console.log(
                  `Loaded encryption key for ${peer.pubkey.toBase58().slice(0, 8)}...: ${Buffer.from(encryptionPublicKey).toString('hex').slice(0, 16)}...`
                );
              }
            }

            return {
              publicKey: peer.pubkey,
              displayName,
              avatarUrl,
              encryptionPublicKey,
              state: peer.status, // Map status to state field
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

  // ========== GROUP METHODS ==========

  const createGroup = async (name: string, tokenGate?: TokenGate) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');
    if (!encryptionKeys) throw new Error('Encryption keys not available');

    setLoading(true);
    try {
      // Generate random group ID
      const groupId = nacl.randomBytes(32);

      // Generate random symmetric key for group
      const groupSecret = nacl.randomBytes(nacl.secretbox.keyLength);

      // Store group key locally
      const groupIdHex = Buffer.from(groupId).toString('hex');
      setGroupKeys(prev => {
        const updated = new Map(prev);
        updated.set(groupIdHex, groupSecret);
        return updated;
      });

      const instruction = createCreateGroupInstruction(
        wallet.publicKey,
        groupId,
        name,
        encryptionKeys.publicKey, // For key distribution
        tokenGate || null
      );

      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadGroups();

      console.log('✅ Group created:', groupIdHex);
      return { groupId, txSignature };
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateGroup = async (groupId: Uint8Array, name?: string, tokenGate?: TokenGate) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createUpdateGroupInstruction(
        wallet.publicKey,
        groupId,
        name || null,
        tokenGate || null
      );

      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadGroups();
      return txSignature;
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const inviteToGroup = async (groupId: Uint8Array, inviteePubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');
    if (!encryptionKeys) throw new Error('Encryption keys not available');

    setLoading(true);
    try {
      const instruction = createInviteToGroupInstruction(wallet.publicKey, groupId, inviteePubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Share group key with invitee via Socket.IO
      const groupIdHex = Buffer.from(groupId).toString('hex');
      const groupSecret = groupKeys.get(groupIdHex);

      if (groupSecret && socket) {
        const inviteeContact = contacts.find(c => c.publicKey.equals(inviteePubkey));
        if (inviteeContact?.encryptionPublicKey) {
          // Encrypt group key with invitee's public key
          const nonce = nacl.randomBytes(nacl.box.nonceLength);
          const encryptedKey = nacl.box(
            groupSecret,
            nonce,
            inviteeContact.encryptionPublicKey,
            encryptionKeys.secretKey
          );

          socket.emit('share_group_key', {
            groupId: groupIdHex,
            recipientPubkey: inviteePubkey.toBase58(),
            encryptedKey: Buffer.from(encryptedKey).toString('base64'),
            nonce: Buffer.from(nonce).toString('base64'),
          });

          console.log('🔑 Shared group key with invitee via Socket.IO');
        }
      }

      return txSignature;
    } catch (error) {
      console.error('Failed to invite to group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const acceptGroupInvite = async (groupId: Uint8Array, userTokenAccount?: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createAcceptGroupInviteInstruction(
        wallet.publicKey,
        groupId,
        userTokenAccount || null
      );

      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadGroups();
      await loadGroupInvites();

      // Notify group via socket
      if (socket) {
        const groupIdHex = Buffer.from(groupId).toString('hex');
        socket.emit('join_group', {
          groupId: groupIdHex,
          memberPubkey: wallet.publicKey.toBase58(),
        });
      }

      return txSignature;
    } catch (error) {
      console.error('Failed to accept group invite:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectGroupInvite = async (groupId: Uint8Array) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createRejectGroupInviteInstruction(wallet.publicKey, groupId);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      await loadGroupInvites();
      return txSignature;
    } catch (error) {
      console.error('Failed to reject group invite:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async (groupId: Uint8Array) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createLeaveGroupInstruction(wallet.publicKey, groupId);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Remove group key from local storage
      const groupIdHex = Buffer.from(groupId).toString('hex');
      setGroupKeys(prev => {
        const updated = new Map(prev);
        updated.delete(groupIdHex);
        return updated;
      });

      // Notify group via socket
      if (socket) {
        socket.emit('leave_group', {
          groupId: groupIdHex,
          memberPubkey: wallet.publicKey.toBase58(),
        });
      }

      await loadGroups();
      return txSignature;
    } catch (error) {
      console.error('Failed to leave group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const kickMember = async (groupId: Uint8Array, memberPubkey: PublicKey) => {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const instruction = createKickMemberInstruction(wallet.publicKey, groupId, memberPubkey);
      const transaction = await buildTransaction(connection, wallet.publicKey, [instruction]);
      const signedTransaction = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendTransaction(signedTransaction);
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Notify group via socket
      if (socket) {
        const groupIdHex = Buffer.from(groupId).toString('hex');
        socket.emit('kick_member', {
          groupId: groupIdHex,
          memberPubkey: memberPubkey.toBase58(),
        });
      }

      // TODO: For production, implement key rotation here
      // Generate new group key and share with remaining members

      await loadGroups();
      return txSignature;
    } catch (error) {
      console.error('Failed to kick member:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendGroupMessage = async (groupId: string, content: string) => {
    if (!wallet?.publicKey || !socket) throw new Error('Not ready');
    if (!encryptionKeys) throw new Error('Encryption keys not available');

    try {
      const groupSecret = groupKeys.get(groupId);
      if (!groupSecret) {
        throw new Error('Group key not found - cannot encrypt message');
      }

      console.log('🔒 Encrypting group message with NaCl secretbox...');

      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const messageBytes = new TextEncoder().encode(content);

      const encrypted = nacl.secretbox(messageBytes, nonce, groupSecret);

      const timestamp = Date.now();
      const encryptedBase64 = Buffer.from(encrypted).toString('base64');
      const nonceBase64 = Buffer.from(nonce).toString('base64');

      socket.emit('send_group_message', {
        groupId,
        encrypted: encryptedBase64,
        nonce: nonceBase64,
        sender: wallet.publicKey.toBase58(),
        timestamp,
      });

      console.log('✅ Encrypted group message sent via socket');

      // Optimistic update
      setGroupMessages(prev => {
        const updated = new Map(prev);
        const msgs = updated.get(groupId) || [];
        updated.set(groupId, [
          ...msgs,
          {
            id: `temp-${timestamp}`,
            groupId,
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
      console.error('Failed to send group message:', error);
      throw error;
    }
  };

  const loadGroups = async () => {
    if (!wallet?.publicKey) return;

    try {
      // Query all groups where user is a member
      // For MVP, we'll need to fetch all user's group PDAs or use a RPC getProgramAccounts call
      // For now, placeholder - will implement when we have the backend index
      console.log('TODO: Implement loadGroups() - query user groups from program');
      setGroups([]);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadGroupInvites = async () => {
    if (!wallet?.publicKey) return;

    try {
      // Query all group invites for this user
      // For MVP, we'll need to fetch all group invite PDAs for this user
      console.log('TODO: Implement loadGroupInvites() - query user group invites');
      setGroupInvites([]);
    } catch (error) {
      console.error('Failed to load group invites:', error);
    }
  };

  const loadGroupMessages = async (groupId: string) => {
    if (!wallet?.publicKey) return;

    try {
      const encryptionSig = (window as any).__mukonEncryptionSignature;
      if (!encryptionSig) {
        console.error('No encryption signature available');
        return;
      }

      const signatureB58 = bs58.encode(encryptionSig);
      const url = `${BACKEND_URL}/group-messages/${groupId}?sender=${wallet.publicKey.toBase58()}&signature=${encodeURIComponent(signatureB58)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load group messages: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📜 Loaded ${data.messages.length} group messages from backend`);

      setGroupMessages(prev => {
        const updated = new Map(prev);
        updated.set(groupId, data.messages);
        return updated;
      });
    } catch (error) {
      console.error('Failed to load group messages:', error);
    }
  };

  const joinGroupRoom = (groupId: string) => {
    if (socket) {
      socket.emit('join_group', { groupId });
      setActiveGroupRoom(groupId);
      console.log('Joining group room:', groupId);
    }
  };

  const leaveGroupRoom = (groupId: string) => {
    if (socket) {
      socket.emit('leave_group_room', { groupId });
      setActiveGroupRoom(null);
      console.log('Leaving group room:', groupId);
    }
  };

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
    closeProfile,
    invite,
    acceptInvitation,
    rejectInvitation,
    deleteContact,
    blockContact,
    unblockContact,
    sendMessage,
    deleteMessage,
    joinConversation,
    leaveConversation,
    decryptConversationMessage,
    loadConversationMessages,
    loadContacts,
    loadProfile,
    // Group methods
    groups,
    groupInvites,
    groupMessages,
    createGroup,
    updateGroup,
    inviteToGroup,
    acceptGroupInvite,
    rejectGroupInvite,
    leaveGroup,
    kickMember,
    sendGroupMessage,
    loadGroups,
    loadGroupInvites,
    loadGroupMessages,
    joinGroupRoom,
    leaveGroupRoom,
  };

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
};
