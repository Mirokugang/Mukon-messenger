import { Connection, PublicKey } from '@solana/web3.js';
import { sha256 } from 'js-sha256';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Solana Name Service constants
const NAME_PROGRAM_ID = new PublicKey('namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX');
const HASH_PREFIX = 'SPL Name Service';
const SOL_TLD_AUTHORITY = new PublicKey('58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx');

/**
 * Get the name account key for a domain
 * Manually implements getDomainKeySync from @bonfida/spl-name-service
 * Based on: https://github.com/Bonfida/sns-sdk/blob/main/js/src/utils.ts
 */
function getDomainKey(domain: string, nameClass?: PublicKey, parentName?: PublicKey): PublicKey {
  // Hash: HASH_PREFIX + domain_name
  const input = HASH_PREFIX + domain.toLowerCase();
  const hashed = sha256(input);

  const seeds = [
    Buffer.from(hashed, 'hex'),
    nameClass ? nameClass.toBuffer() : Buffer.alloc(32),
    parentName ? parentName.toBuffer() : Buffer.alloc(32),
  ];

  const [nameAccountKey] = PublicKey.findProgramAddressSync(
    seeds,
    NAME_PROGRAM_ID
  );

  return nameAccountKey;
}

/**
 * Deserialize name registry state
 * Based on NameRegistryState from @bonfida/spl-name-service
 */
function deserializeNameRegistry(data: Buffer): { owner: PublicKey } | null {
  try {
    // NameRegistryState layout:
    // - parentName: [u8; 32]
    // - owner: [u8; 32]
    // - class: [u8; 32]
    // - data: remaining bytes

    if (data.length < 96) return null;

    const ownerBytes = data.slice(32, 64);
    const owner = new PublicKey(ownerBytes);

    return { owner };
  } catch (error) {
    console.error('Failed to deserialize name registry:', error);
    return null;
  }
}

/**
 * Resolve a .sol or .skr domain to a Solana public key
 * @param domain - The domain name (with or without .sol/.skr)
 * @param connection - Solana connection
 * @returns PublicKey if resolved, null if not found
 */
export async function resolveDomain(
  domain: string,
  connection: Connection
): Promise<{ publicKey: PublicKey; domain: string } | null> {
  try {
    // Remove .sol or .skr suffix if present
    let cleanDomain = domain.trim().toLowerCase();
    if (cleanDomain.endsWith('.sol')) {
      cleanDomain = cleanDomain.slice(0, -4);
    } else if (cleanDomain.endsWith('.skr')) {
      cleanDomain = cleanDomain.slice(0, -4);
    }

    // Get the domain key (PDA)
    const domainKey = getDomainKey(cleanDomain);

    // Fetch the name registry account
    const accountInfo = await connection.getAccountInfo(domainKey);

    if (!accountInfo || !accountInfo.data) {
      console.log('Domain not found:', cleanDomain);
      return null;
    }

    // Deserialize to get owner
    const registry = deserializeNameRegistry(accountInfo.data);

    if (!registry || !registry.owner) {
      return null;
    }

    return {
      publicKey: registry.owner,
      domain: cleanDomain,
    };
  } catch (error) {
    console.log('Domain resolution failed:', error);
    return null;
  }
}

/**
 * Check if input is a domain name (.sol or .skr)
 */
export function isDomain(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return trimmed.endsWith('.sol') || trimmed.endsWith('.skr');
}

/**
 * Reverse lookup: get domain name for a public key
 * Note: This requires Bonfida's reverse lookup registry (may not exist for all addresses)
 */
export async function reverseLookup(
  publicKey: PublicKey,
  connection: Connection
): Promise<string | null> {
  try {
    // TODO: Implement reverse lookup using Bonfida's reverse registry
    // For now, return null - we'll rely on stored domain names
    return null;
  } catch (error) {
    console.log('Reverse lookup failed:', error);
    return null;
  }
}

// Contact custom name storage (local AsyncStorage)
// All keys now scoped by owner wallet to prevent cross-wallet data leakage

const CUSTOM_NAME_PREFIX = '@mukon_contact_name_';

/**
 * Set a custom name for a contact (local storage, wallet-scoped)
 */
export async function setContactCustomName(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey,
  customName: string
): Promise<void> {
  const key = `${CUSTOM_NAME_PREFIX}${ownerWallet.toBase58()}_${contactPubkey.toBase58()}`;
  if (customName.trim()) {
    await AsyncStorage.setItem(key, customName.trim());
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Get custom name for a contact (wallet-scoped)
 * @returns custom name if set, null otherwise
 */
export async function getContactCustomName(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey
): Promise<string | null> {
  const key = `${CUSTOM_NAME_PREFIX}${ownerWallet.toBase58()}_${contactPubkey.toBase58()}`;
  return await AsyncStorage.getItem(key);
}

/**
 * Remove custom name for a contact (wallet-scoped)
 */
export async function removeContactCustomName(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey
): Promise<void> {
  const key = `${CUSTOM_NAME_PREFIX}${ownerWallet.toBase58()}_${contactPubkey.toBase58()}`;
  await AsyncStorage.removeItem(key);
}

/**
 * Get display name for a contact with fallback priority:
 * 1. Custom name (set by user)
 * 2. Domain name (.sol/.skr)
 * 3. Truncated public key
 */
export async function getContactDisplayName(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey,
  domainName?: string
): Promise<string> {
  // Try custom name first
  const customName = await getContactCustomName(ownerWallet, contactPubkey);
  if (customName) {
    return customName;
  }

  // Try domain name
  if (domainName) {
    return domainName.endsWith('.sol') || domainName.endsWith('.skr')
      ? domainName
      : `${domainName}.sol`;
  }

  // Fallback to truncated pubkey
  const pubkeyStr = contactPubkey.toBase58();
  return `${pubkeyStr.slice(0, 4)}...${pubkeyStr.slice(-4)}`;
}

/**
 * Store resolved domain name for a contact (for faster lookup, wallet-scoped)
 */
const DOMAIN_CACHE_PREFIX = '@mukon_domain_';

export async function cacheResolvedDomain(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey,
  domain: string
): Promise<void> {
  const key = `${DOMAIN_CACHE_PREFIX}${ownerWallet.toBase58()}_${contactPubkey.toBase58()}`;
  await AsyncStorage.setItem(key, domain);
}

export async function getCachedDomain(
  ownerWallet: PublicKey,
  contactPubkey: PublicKey
): Promise<string | null> {
  const key = `${DOMAIN_CACHE_PREFIX}${ownerWallet.toBase58()}_${contactPubkey.toBase58()}`;
  return await AsyncStorage.getItem(key);
}

/**
 * Store group avatar (emoji) locally in AsyncStorage (wallet-scoped)
 */
const GROUP_AVATAR_PREFIX = '@mukon_group_avatar_';

export async function setGroupAvatar(
  ownerWallet: PublicKey,
  groupId: string,
  emoji: string
): Promise<void> {
  const key = `${GROUP_AVATAR_PREFIX}${ownerWallet.toBase58()}_${groupId}`;
  await AsyncStorage.setItem(key, emoji.trim());
}

export async function getGroupAvatar(
  ownerWallet: PublicKey,
  groupId: string
): Promise<string | null> {
  const key = `${GROUP_AVATAR_PREFIX}${ownerWallet.toBase58()}_${groupId}`;
  return await AsyncStorage.getItem(key);
}

/**
 * Store group custom name locally in AsyncStorage (wallet-scoped)
 * For non-admin members to have local-only group names
 */
const GROUP_NAME_PREFIX = '@mukon_group_name_';

export async function setGroupLocalName(
  ownerWallet: PublicKey,
  groupId: string,
  name: string
): Promise<void> {
  const key = `${GROUP_NAME_PREFIX}${ownerWallet.toBase58()}_${groupId}`;
  if (name.trim()) {
    await AsyncStorage.setItem(key, name.trim());
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export async function getGroupLocalName(
  ownerWallet: PublicKey,
  groupId: string
): Promise<string | null> {
  const key = `${GROUP_NAME_PREFIX}${ownerWallet.toBase58()}_${groupId}`;
  return await AsyncStorage.getItem(key);
}

export async function removeGroupLocalName(
  ownerWallet: PublicKey,
  groupId: string
): Promise<void> {
  const key = `${GROUP_NAME_PREFIX}${ownerWallet.toBase58()}_${groupId}`;
  await AsyncStorage.removeItem(key);
}
