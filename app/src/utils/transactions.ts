import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

const PROGRAM_ID = new PublicKey('DGAPfs1DAjt5p5J5Z5trtgCeFBWMfh2mck2ZqHbySabv');

// Instruction discriminators from IDL
const DISCRIMINATORS = {
  register: Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]),
  invite: Buffer.from([242, 24, 235, 225, 133, 211, 189, 250]),
  accept: Buffer.from([65, 150, 70, 216, 133, 6, 107, 4]),
  reject: Buffer.from([135, 7, 63, 85, 131, 114, 111, 224]),
  updateProfile: Buffer.from([98, 67, 99, 206, 86, 115, 175, 1]),
  block: Buffer.from([238, 234, 110, 21, 121, 43, 50, 145]),
  unblock: Buffer.from([194, 49, 173, 43, 246, 164, 14, 11]),
};

// PDA derivation helpers
export function getWalletDescriptorPDA(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('wallet_descriptor'), owner.toBuffer(), Buffer.from([1])],
    PROGRAM_ID
  );
  return pda;
}

export function getUserProfilePDA(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_profile'), owner.toBuffer(), Buffer.from([1])],
    PROGRAM_ID
  );
  return pda;
}

export function getConversationPDA(chatHash: Uint8Array): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('conversation'), chatHash, Buffer.from([1])],
    PROGRAM_ID
  );
  return pda;
}

// Borsh serialization helpers
function serializeString(str: string): Buffer {
  const encoded = Buffer.from(str, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32LE(encoded.length, 0);
  return Buffer.concat([length, encoded]);
}

/**
 * Build register instruction
 */
export function createRegisterInstruction(
  payer: PublicKey,
  displayName: string,
  encryptionPublicKey: Uint8Array
): TransactionInstruction {
  const walletDescriptor = getWalletDescriptorPDA(payer);
  const userProfile = getUserProfilePDA(payer);

  // Serialize instruction data: discriminator + displayName + encryptionPublicKey (32 bytes, no length prefix)
  const data = Buffer.concat([
    DISCRIMINATORS.register,
    serializeString(displayName),
    Buffer.from(encryptionPublicKey),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: walletDescriptor, isSigner: false, isWritable: true },
      { pubkey: userProfile, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build invite instruction
 */
export function createInviteInstruction(
  payer: PublicKey,
  invitee: PublicKey,
  chatHash: Uint8Array
): TransactionInstruction {
  const payerDescriptor = getWalletDescriptorPDA(payer);
  const inviteeDescriptor = getWalletDescriptorPDA(invitee);
  const conversation = getConversationPDA(chatHash);

  // Serialize instruction data: discriminator + hash (32 bytes, no length prefix for fixed array)
  const data = Buffer.concat([
    DISCRIMINATORS.invite,
    Buffer.from(chatHash),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: invitee, isSigner: false, isWritable: false },
      { pubkey: payerDescriptor, isSigner: false, isWritable: true },
      { pubkey: inviteeDescriptor, isSigner: false, isWritable: true },
      { pubkey: conversation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build accept instruction
 */
export function createAcceptInstruction(
  payer: PublicKey,
  peer: PublicKey
): TransactionInstruction {
  const payerDescriptor = getWalletDescriptorPDA(payer);
  const peerDescriptor = getWalletDescriptorPDA(peer);

  // Serialize instruction data: just discriminator (no args)
  const data = DISCRIMINATORS.accept;

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: peer, isSigner: false, isWritable: false },
      { pubkey: payerDescriptor, isSigner: false, isWritable: true },
      { pubkey: peerDescriptor, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build reject instruction (delete contact)
 */
export function createRejectInstruction(
  payer: PublicKey,
  peer: PublicKey
): TransactionInstruction {
  const payerDescriptor = getWalletDescriptorPDA(payer);
  const peerDescriptor = getWalletDescriptorPDA(peer);

  const data = DISCRIMINATORS.reject;

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: peer, isSigner: false, isWritable: false },
      { pubkey: payerDescriptor, isSigner: false, isWritable: true },
      { pubkey: peerDescriptor, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Alias for consistency
export const createRejectInvitationInstruction = createRejectInstruction;

/**
 * Build block instruction (hard block contact)
 */
export function createBlockInstruction(
  payer: PublicKey,
  peer: PublicKey
): TransactionInstruction {
  const payerDescriptor = getWalletDescriptorPDA(payer);
  const peerDescriptor = getWalletDescriptorPDA(peer);

  const data = DISCRIMINATORS.block;

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: peer, isSigner: false, isWritable: false },
      { pubkey: payerDescriptor, isSigner: false, isWritable: true },
      { pubkey: peerDescriptor, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build unblock instruction (change Blocked → Rejected)
 */
export function createUnblockInstruction(
  payer: PublicKey,
  peer: PublicKey
): TransactionInstruction {
  const payerDescriptor = getWalletDescriptorPDA(payer);
  const peerDescriptor = getWalletDescriptorPDA(peer);

  const data = DISCRIMINATORS.unblock;

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: peer, isSigner: false, isWritable: false },
      { pubkey: payerDescriptor, isSigner: false, isWritable: true },
      { pubkey: peerDescriptor, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build update_profile instruction
 */
export function createUpdateProfileInstruction(
  payer: PublicKey,
  displayName: string | null,
  avatarUrl: string | null,
  encryptionPublicKey: Uint8Array | null
): TransactionInstruction {
  const userProfile = getUserProfilePDA(payer);

  // Serialize instruction data: discriminator + Option<String> + Option<String> + Option<[u8; 32]>
  const parts: Buffer[] = [DISCRIMINATORS.updateProfile];

  // Serialize Option<String> for display_name
  if (displayName !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(serializeString(displayName));
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // Serialize Option<String> for avatar_url
  if (avatarUrl !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(serializeString(avatarUrl));
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // Serialize Option<[u8; 32]> for encryption_public_key
  if (encryptionPublicKey !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(Buffer.from(encryptionPublicKey));
  } else {
    parts.push(Buffer.from([0])); // None
  }

  const data = Buffer.concat(parts);

  return new TransactionInstruction({
    keys: [
      { pubkey: userProfile, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build a VersionedTransaction from instructions
 */
export async function buildTransaction(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<VersionedTransaction> {
  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  // Build v0 transaction message
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  // Create versioned transaction
  return new VersionedTransaction(message);
}

// Deserialization helpers
export interface Peer {
  pubkey: PublicKey;
  status: 'Invited' | 'Requested' | 'Accepted' | 'Rejected' | 'Blocked';
}

export interface WalletDescriptor {
  owner: PublicKey;
  peers: Peer[];
}

export function deserializeWalletDescriptor(data: Buffer): WalletDescriptor {
  let offset = 8; // Skip 8-byte discriminator

  // Read owner (32 bytes)
  const owner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read peers vector length (4 bytes)
  const peersLength = data.readUInt32LE(offset);
  offset += 4;

  // Read each peer
  const peers: Peer[] = [];
  for (let i = 0; i < peersLength; i++) {
    // Read peer pubkey (32 bytes)
    const pubkey = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read peer state (1 byte)
    const stateNum = data.readUInt8(offset);
    offset += 1;

    const status = ['Invited', 'Requested', 'Accepted', 'Rejected', 'Blocked'][stateNum] as
      | 'Invited'
      | 'Requested'
      | 'Accepted'
      | 'Rejected'
      | 'Blocked';

    peers.push({ pubkey, status });
  }

  return { owner, peers };
}
