import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { sha256 } from 'js-sha256';
import { Buffer } from 'buffer';

/**
 * Derives an encryption keypair from a wallet signature
 */
export function deriveEncryptionKeypair(signature: Uint8Array): nacl.BoxKeyPair {
  // Use the signature as seed for deterministic keypair generation
  const seed = signature.slice(0, 32);
  return nacl.box.keyPair.fromSecretKey(seed);
}

/**
 * Encrypts a message for a recipient using their public key
 */
export function encryptMessage(
  content: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): { encrypted: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = new TextEncoder().encode(content);

  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

/**
 * Decrypts a message using the recipient's secret key
 */
export function decryptMessage(
  encrypted: string,
  nonce: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string | null {
  try {
    const encryptedBytes = Buffer.from(encrypted, 'base64');
    const nonceBytes = Buffer.from(nonce, 'base64');

    const decrypted = nacl.box.open(
      encryptedBytes,
      nonceBytes,
      senderPublicKey,
      recipientSecretKey
    );

    if (!decrypted) {
      return null;
    }

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Gets a deterministic chat hash from two public keys (sorted)
 */
export function getChatHash(a: PublicKey, b: PublicKey): Uint8Array {
  const combined = Buffer.alloc(64);

  // Sort pubkeys deterministically
  if (a.toBuffer().compare(b.toBuffer()) < 0) {
    a.toBuffer().copy(combined, 0);
    b.toBuffer().copy(combined, 32);
  } else {
    b.toBuffer().copy(combined, 0);
    a.toBuffer().copy(combined, 32);
  }

  // Use js-sha256 instead of Node's crypto
  const hash = sha256.array(combined);
  return new Uint8Array(hash);
}

/**
 * Truncates a wallet address for display (e.g., "7xKp...3mNq")
 */
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
