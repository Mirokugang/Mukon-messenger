import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getContactCustomName, getCachedDomain, getContactDisplayName } from '../utils/domains';

export interface ContactDisplayInfo {
  displayName: string;
  isCustomName: boolean;
  isDomain: boolean;
  originalName?: string;
}

/**
 * Hook to manage contact display names with priority:
 * 1. Custom name (user-set)
 * 2. Domain name (.sol/.skr)
 * 3. On-chain display name
 * 4. Truncated pubkey
 */
export function useContactNames(
  ownerWallet: PublicKey | null,
  contacts: Array<{ publicKey: PublicKey; displayName?: string }>
) {
  const [displayNames, setDisplayNames] = useState<Map<string, ContactDisplayInfo>>(new Map());

  useEffect(() => {
    if (!ownerWallet) return;

    const loadDisplayNames = async () => {
      const nameMap = new Map<string, ContactDisplayInfo>();

      for (const contact of contacts) {
        const pubkeyStr = contact.publicKey.toBase58();

        // Check custom name first
        const customName = await getContactCustomName(ownerWallet, contact.publicKey);
        if (customName) {
          nameMap.set(pubkeyStr, {
            displayName: customName,
            isCustomName: true,
            isDomain: false,
            originalName: contact.displayName,
          });
          continue;
        }

        // Check cached domain name
        const cachedDomain = await getCachedDomain(ownerWallet, contact.publicKey);
        if (cachedDomain) {
          const domainDisplay = cachedDomain.endsWith('.sol') || cachedDomain.endsWith('.skr')
            ? cachedDomain
            : `${cachedDomain}.sol`;

          nameMap.set(pubkeyStr, {
            displayName: domainDisplay,
            isCustomName: false,
            isDomain: true,
            originalName: contact.displayName,
          });
          continue;
        }

        // Use on-chain display name or fallback to truncated pubkey
        const displayName = contact.displayName || `${pubkeyStr.slice(0, 4)}...${pubkeyStr.slice(-4)}`;
        nameMap.set(pubkeyStr, {
          displayName,
          isCustomName: false,
          isDomain: false,
        });
      }

      setDisplayNames(nameMap);
    };

    loadDisplayNames();
  }, [ownerWallet, contacts]);

  return displayNames;
}
