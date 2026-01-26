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
// NOTE: Group discriminators need to be computed after program deployment
// Use: anchor idl parse -f programs/mukon-messenger/target/idl/mukon_messenger.json
const DISCRIMINATORS = {
  accept: Buffer.from([0x41, 0x96, 0x46, 0xd8, 0x85, 0x06, 0x6b, 0x04]), // 419646d885066b04
  accept_group_invite: Buffer.from([0xbe, 0x30, 0x7f, 0x36, 0x49, 0x93, 0xe3, 0xfd]), // be307f364993e3fd
  block: Buffer.from([0xee, 0xea, 0x6e, 0x15, 0x79, 0x2b, 0x32, 0x91]), // eeea6e15792b3291
  close_profile: Buffer.from([0xa7, 0x24, 0xb5, 0x08, 0x88, 0x9e, 0x2e, 0xcf]), // a724b508889e2ecf
  create_group: Buffer.from([0x4f, 0x3c, 0x9e, 0x86, 0x3d, 0xc7, 0x38, 0xf8]), // 4f3c9e863dc738f8
  invite: Buffer.from([0xf2, 0x18, 0xeb, 0xe1, 0x85, 0xd3, 0xbd, 0xfa]), // f218ebe185d3bdfa
  invite_to_group: Buffer.from([0xf2, 0x88, 0x70, 0x57, 0x31, 0xcf, 0xc1, 0x54]), // f288705731cfc154
  kick_member: Buffer.from([0x4e, 0x41, 0xd7, 0xf4, 0x67, 0xca, 0xe4, 0x1b]), // 4e41d7f467cae41b
  leave_group: Buffer.from([0x0a, 0x04, 0x7d, 0x1c, 0x2e, 0x17, 0xe9, 0x1d]), // 0a047d1c2e17e91d
  register: Buffer.from([0xd3, 0x7c, 0x43, 0x0f, 0xd3, 0xc2, 0xb2, 0xf0]), // d37c430fd3c2b2f0
  reject: Buffer.from([0x87, 0x07, 0x3f, 0x55, 0x83, 0x72, 0x6f, 0xe0]), // 87073f5583726fe0
  reject_group_invite: Buffer.from([0xa2, 0xe1, 0x8b, 0x8e, 0x35, 0xb6, 0xd9, 0xe7]), // a2e18b8e35b6d9e7
  unblock: Buffer.from([0xc2, 0x31, 0xad, 0x2b, 0xf6, 0xa4, 0x0e, 0x0b]), // c231ad2bf6a40e0b
  update_group: Buffer.from([0x09, 0xf2, 0x01, 0x6e, 0x5b, 0x16, 0xac, 0x61]), // 09f2016e5b16ac61
  update_profile: Buffer.from([0x62, 0x43, 0x63, 0xce, 0x56, 0x73, 0xaf, 0x01]), // 624363ce5673af01
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

export function getGroupPDA(groupId: Uint8Array): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('group'), Buffer.from(groupId), Buffer.from([1])],
    PROGRAM_ID
  );
  return pda;
}

export function getGroupInvitePDA(groupId: Uint8Array, invitee: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('group_invite'), Buffer.from(groupId), invitee.toBuffer(), Buffer.from([1])],
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
  avatarData: string,
  encryptionPublicKey: Uint8Array
): TransactionInstruction {
  const walletDescriptor = getWalletDescriptorPDA(payer);
  const userProfile = getUserProfilePDA(payer);

  // Serialize instruction data: discriminator + displayName + avatarData + encryptionPublicKey
  const data = Buffer.concat([
    DISCRIMINATORS.register,
    serializeString(displayName),
    serializeString(avatarData),
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
 * Build close_profile instruction
 * WARNING: This closes the account and returns rent - destructive operation!
 * Useful for testing/redeployment during development.
 */
export function createCloseProfileInstruction(
  payer: PublicKey
): TransactionInstruction {
  const userProfile = getUserProfilePDA(payer);

  const data = DISCRIMINATORS.closeProfile;

  return new TransactionInstruction({
    keys: [
      { pubkey: userProfile, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
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
  avatarType: 'Emoji' | 'Nft' | null,
  avatarData: string | null,
  encryptionPublicKey: Uint8Array | null
): TransactionInstruction {
  const userProfile = getUserProfilePDA(payer);

  // Serialize instruction data: discriminator + Option<String> + Option<AvatarType> + Option<String> + Option<[u8; 32]>
  const parts: Buffer[] = [DISCRIMINATORS.updateProfile];

  // Serialize Option<String> for display_name
  if (displayName !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(serializeString(displayName));
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // Serialize Option<AvatarType> for avatar_type
  if (avatarType !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(Buffer.from([avatarType === 'Emoji' ? 0 : 1])); // Enum: Emoji=0, Nft=1
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // Serialize Option<String> for avatar_data
  if (avatarData !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(serializeString(avatarData));
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

// ========== GROUP INSTRUCTION BUILDERS ==========

/**
 * Serialize Option<TokenGate>
 */
function serializeOptionTokenGate(tokenGate: { mint: PublicKey; minBalance: bigint } | null): Buffer {
  if (tokenGate === null) {
    return Buffer.from([0]); // None
  }

  const minBalanceBuffer = Buffer.alloc(8);
  minBalanceBuffer.writeBigUInt64LE(tokenGate.minBalance, 0);

  return Buffer.concat([
    Buffer.from([1]), // Some
    tokenGate.mint.toBuffer(),
    minBalanceBuffer,
  ]);
}

/**
 * Build create_group instruction
 */
export function createCreateGroupInstruction(
  payer: PublicKey,
  groupId: Uint8Array,
  name: string,
  encryptionPubkey: Uint8Array,
  tokenGate: { mint: PublicKey; minBalance: bigint } | null
): TransactionInstruction {
  const group = getGroupPDA(groupId);

  const data = Buffer.concat([
    DISCRIMINATORS.createGroup,
    Buffer.from(groupId),
    serializeString(name),
    Buffer.from(encryptionPubkey),
    serializeOptionTokenGate(tokenGate),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build update_group instruction
 */
export function createUpdateGroupInstruction(
  payer: PublicKey,
  groupId: Uint8Array,
  name: string | null,
  tokenGate: { mint: PublicKey; minBalance: bigint } | null
): TransactionInstruction {
  const group = getGroupPDA(groupId);

  const parts: Buffer[] = [DISCRIMINATORS.updateGroup];

  // Serialize Option<String> for name
  if (name !== null) {
    parts.push(Buffer.from([1])); // Some
    parts.push(serializeString(name));
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // Serialize Option<TokenGate>
  parts.push(serializeOptionTokenGate(tokenGate));

  const data = Buffer.concat(parts);

  return new TransactionInstruction({
    keys: [
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build invite_to_group instruction
 */
export function createInviteToGroupInstruction(
  payer: PublicKey,
  groupId: Uint8Array,
  invitee: PublicKey
): TransactionInstruction {
  const group = getGroupPDA(groupId);
  const groupInvite = getGroupInvitePDA(groupId, invitee);

  const data = DISCRIMINATORS.inviteToGroup;

  return new TransactionInstruction({
    keys: [
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: groupInvite, isSigner: false, isWritable: true },
      { pubkey: invitee, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build accept_group_invite instruction
 */
export function createAcceptGroupInviteInstruction(
  payer: PublicKey,
  groupId: Uint8Array,
  userTokenAccount: PublicKey | null
): TransactionInstruction {
  const group = getGroupPDA(groupId);
  const groupInvite = getGroupInvitePDA(groupId, payer);

  const data = DISCRIMINATORS.acceptGroupInvite;

  const keys = [
    { pubkey: group, isSigner: false, isWritable: true },
    { pubkey: groupInvite, isSigner: false, isWritable: true },
  ];

  // Add token account if provided (for token-gated groups)
  if (userTokenAccount !== null) {
    keys.push({ pubkey: userTokenAccount, isSigner: false, isWritable: false });
  }

  keys.push(
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  );

  // Add token program if token account provided
  if (userTokenAccount !== null) {
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    keys.push({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build reject_group_invite instruction
 */
export function createRejectGroupInviteInstruction(
  payer: PublicKey,
  groupId: Uint8Array
): TransactionInstruction {
  const groupInvite = getGroupInvitePDA(groupId, payer);

  const data = DISCRIMINATORS.rejectGroupInvite;

  return new TransactionInstruction({
    keys: [
      { pubkey: groupInvite, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build leave_group instruction
 */
export function createLeaveGroupInstruction(
  payer: PublicKey,
  groupId: Uint8Array
): TransactionInstruction {
  const group = getGroupPDA(groupId);

  const data = DISCRIMINATORS.leaveGroup;

  return new TransactionInstruction({
    keys: [
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Build kick_member instruction
 */
export function createKickMemberInstruction(
  payer: PublicKey,
  groupId: Uint8Array,
  member: PublicKey
): TransactionInstruction {
  const group = getGroupPDA(groupId);

  const data = DISCRIMINATORS.kickMember;

  return new TransactionInstruction({
    keys: [
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: member, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// ========== TRANSACTION BUILDER ==========

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

// Group types and deserialization
export interface TokenGate {
  mint: PublicKey;
  minBalance: bigint;
}

export interface Group {
  groupId: Uint8Array;
  creator: PublicKey;
  name: string;
  createdAt: bigint;
  members: PublicKey[];
  encryptionPubkey: Uint8Array;
  tokenGate: TokenGate | null;
}

export interface GroupInvite {
  groupId: Uint8Array;
  inviter: PublicKey;
  invitee: PublicKey;
  status: 'Pending' | 'Accepted' | 'Rejected';
  createdAt: bigint;
}

export function deserializeGroup(data: Buffer): Group {
  let offset = 8; // Skip 8-byte discriminator

  // Read group_id (32 bytes)
  const groupId = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  // Read creator (32 bytes)
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read name (string with length prefix)
  const nameLength = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLength).toString('utf8');
  offset += nameLength;

  // Read created_at (8 bytes)
  const createdAt = data.readBigInt64LE(offset);
  offset += 8;

  // Read members vector
  const membersLength = data.readUInt32LE(offset);
  offset += 4;
  const members: PublicKey[] = [];
  for (let i = 0; i < membersLength; i++) {
    members.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  // Read encryption_pubkey (32 bytes)
  const encryptionPubkey = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  // Read Option<TokenGate>
  const hasTokenGate = data.readUInt8(offset);
  offset += 1;

  let tokenGate: TokenGate | null = null;
  if (hasTokenGate === 1) {
    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const minBalance = data.readBigUInt64LE(offset);
    offset += 8;
    tokenGate = { mint, minBalance };
  }

  return {
    groupId,
    creator,
    name,
    createdAt,
    members,
    encryptionPubkey,
    tokenGate,
  };
}

export function deserializeGroupInvite(data: Buffer): GroupInvite {
  let offset = 8; // Skip 8-byte discriminator

  // Read group_id (32 bytes)
  const groupId = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  // Read inviter (32 bytes)
  const inviter = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read invitee (32 bytes)
  const invitee = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read status (1 byte)
  const statusNum = data.readUInt8(offset);
  offset += 1;
  const status = ['Pending', 'Accepted', 'Rejected'][statusNum] as 'Pending' | 'Accepted' | 'Rejected';

  // Read created_at (8 bytes)
  const createdAt = data.readBigInt64LE(offset);
  offset += 8;

  return {
    groupId,
    inviter,
    invitee,
    status,
    createdAt,
  };
}
