import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

const PROGRAM_ID = new PublicKey('89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr');

// Instruction discriminators from IDL
const DISCRIMINATORS = {
  register: Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]),
  invite: Buffer.from([242, 24, 235, 225, 133, 211, 189, 250]),
  accept: Buffer.from([65, 150, 70, 216, 133, 6, 107, 4]),
  reject: Buffer.from([135, 7, 63, 85, 131, 114, 111, 224]),
  updateProfile: Buffer.from([98, 67, 99, 206, 86, 115, 175, 1]),
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
  displayName: string
): TransactionInstruction {
  const walletDescriptor = getWalletDescriptorPDA(payer);
  const userProfile = getUserProfilePDA(payer);

  // Serialize instruction data: discriminator + displayName
  const data = Buffer.concat([
    DISCRIMINATORS.register,
    serializeString(displayName),
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
 * Build reject instruction
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
