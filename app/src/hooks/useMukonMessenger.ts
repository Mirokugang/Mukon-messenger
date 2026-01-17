import { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, web3 } from '@coral-xyz/anchor';
import io, { Socket } from 'socket.io-client';
import { encryptMessage, decryptMessage, getChatHash, truncateAddress } from '../utils/encryption';
import nacl from 'tweetnacl';
import { Buffer } from '@craftzdog/react-native-buffer';
import IDL from '../idl.json';

const PROGRAM_ID = new PublicKey('89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr');
const BACKEND_URL = 'http://localhost:3001';
const WALLET_DESCRIPTOR_VERSION = Buffer.from([1]);
const USER_PROFILE_VERSION = Buffer.from([1]);
const CONVERSATION_VERSION = Buffer.from([1]);

interface Wallet {
  publicKey: PublicKey | null;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
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

  // Initialize program
  const program = useMemo(() => {
    if (!wallet?.publicKey) return null;

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );

    return new Program(IDL as Idl, PROGRAM_ID, provider);
  }, [wallet, connection]);

  // Get PDAs for a wallet
  const getPDAs = (pubkey: PublicKey) => {
    const [walletDescriptor] = PublicKey.findProgramAddressSync(
      [Buffer.from('wallet_descriptor'), pubkey.toBuffer(), WALLET_DESCRIPTOR_VERSION],
      PROGRAM_ID
    );

    const [userProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), pubkey.toBuffer(), USER_PROFILE_VERSION],
      PROGRAM_ID
    );

    return { walletDescriptor, userProfile };
  };

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
    if (!wallet?.publicKey || !program) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const { walletDescriptor, userProfile } = getPDAs(wallet.publicKey);

      const tx = await program.methods
        .register(displayName)
        .accounts({
          walletDescriptor,
          userProfile,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Registered user:', displayName, 'TX:', tx);

      setProfile({ displayName, publicKey: wallet.publicKey });
      return tx;
    } catch (error) {
      console.error('Failed to register:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (displayName?: string, avatarUrl?: string) => {
    if (!wallet?.publicKey || !program) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const { userProfile } = getPDAs(wallet.publicKey);

      const tx = await program.methods
        .updateProfile(displayName || null, avatarUrl || null)
        .accounts({
          userProfile,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Updated profile, TX:', tx);

      if (displayName) {
        setProfile((prev: any) => ({ ...prev, displayName }));
      }

      return tx;
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
    if (!wallet?.publicKey || !program) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const { walletDescriptor: payerDescriptor } = getPDAs(wallet.publicKey);
      const { walletDescriptor: inviteeDescriptor } = getPDAs(contactPubkey);

      const chatHash = getChatHash(wallet.publicKey, contactPubkey);
      const [conversation] = PublicKey.findProgramAddressSync(
        [Buffer.from('conversation'), chatHash, CONVERSATION_VERSION],
        PROGRAM_ID
      );

      const tx = await program.methods
        .invite(Array.from(chatHash))
        .accounts({
          payer: wallet.publicKey,
          invitee: contactPubkey,
          payerDescriptor,
          inviteeDescriptor,
          conversation,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Sent invitation to:', contactPubkey.toBase58(), 'TX:', tx);
      return tx;
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
    if (!wallet?.publicKey || !program) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const { walletDescriptor: payerDescriptor } = getPDAs(wallet.publicKey);
      const { walletDescriptor: peerDescriptor } = getPDAs(peerPubkey);

      const tx = await program.methods
        .accept()
        .accounts({
          payer: wallet.publicKey,
          peer: peerPubkey,
          payerDescriptor,
          peerDescriptor,
        })
        .rpc();

      console.log('Accepted invitation from:', peerPubkey.toBase58(), 'TX:', tx);
      await loadContacts(); // Refresh contacts
      return tx;
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
    if (!wallet?.publicKey || !program) throw new Error('Wallet not connected');

    setLoading(true);
    try {
      const { walletDescriptor: payerDescriptor } = getPDAs(wallet.publicKey);
      const { walletDescriptor: peerDescriptor } = getPDAs(peerPubkey);

      const tx = await program.methods
        .reject()
        .accounts({
          payer: wallet.publicKey,
          peer: peerPubkey,
          payerDescriptor,
          peerDescriptor,
        })
        .rpc();

      console.log('Rejected invitation from:', peerPubkey.toBase58(), 'TX:', tx);
      await loadContacts();
      return tx;
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
   */
  const loadContacts = async () => {
    if (!wallet?.publicKey || !program) return;

    setLoading(true);
    try {
      const { walletDescriptor } = getPDAs(wallet.publicKey);

      const descriptorAccount = await program.account.walletDescriptor.fetch(walletDescriptor);

      // Get all accepted peers
      const acceptedPeers = descriptorAccount.peers.filter(
        (peer: any) => peer.state.accepted !== undefined
      );

      // Fetch each peer's profile
      const contactsData = await Promise.all(
        acceptedPeers.map(async (peer: any) => {
          try {
            const { userProfile } = getPDAs(peer.wallet);
            const profileAccount = await program.account.userProfile.fetch(userProfile);

            return {
              publicKey: peer.wallet,
              displayName: profileAccount.displayName,
              avatarUrl: profileAccount.avatarUrl,
            };
          } catch (error) {
            // Profile might not exist
            return {
              publicKey: peer.wallet,
              displayName: null,
              avatarUrl: null,
            };
          }
        })
      );

      setContacts(contactsData);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load user profile
   */
  const loadProfile = async () => {
    if (!wallet?.publicKey || !program) return;

    try {
      const { userProfile } = getPDAs(wallet.publicKey);
      const profileAccount = await program.account.userProfile.fetch(userProfile);

      setProfile({
        displayName: profileAccount.displayName,
        avatarUrl: profileAccount.avatarUrl,
        publicKey: wallet.publicKey,
      });
    } catch (error) {
      // Profile doesn't exist yet
      console.log('No profile found, user needs to register');
    }
  };

  // Load profile and contacts on wallet connect
  useEffect(() => {
    if (wallet?.publicKey && program) {
      loadProfile();
      loadContacts();
    }
  }, [wallet?.publicKey, program]);

  return {
    connection,
    program,
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
