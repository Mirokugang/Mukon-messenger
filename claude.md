# Mukon Messenger - Claude Code Development Brief

## Project Overview

Build a private, wallet-to-wallet encrypted messenger for the Solana Privacy Hackathon (Jan 12-30, 2026).

**Goal:** Win multiple bounties ($48K+ potential) by creating a privacy-first messenger that integrates Arcium for encrypted on-chain state.

## Development Guidelines

**IMPORTANT - Dev Servers & Builds:**
- NEVER run dev servers (npx expo start, npm run dev, etc.) - only the user should run these
- NEVER run builds (npx expo run:android) - only the user should build and install via ADB
- User needs to see device logs directly, which are not visible to Claude
- All testing/debugging should be done by the user running their own dev servers and builds

---

## ⚠️ TEMPORARY: Program Redeployment Strategy (Devnet Only)

**For hackathon development**, we use `close_profile` to allow re-registration after breaking program changes:

```rust
pub fn close_profile(ctx: Context<CloseProfile>) -> Result<()> {
    // Closes UserProfile account and returns rent
    // Allows re-registration after schema changes
    Ok(())
}
```

**Usage:**
```typescript
await messenger.closeProfile(); // Close old account
await messenger.register('Name', '🦅'); // Re-register with new schema
```

**WHY:** During development, account structures change (e.g., added `avatar_type` field). Solana accounts can't be re-initialized, so `close_profile` destroys old accounts for fresh registration. **This is ONLY acceptable on devnet.**

### 🚨 BEFORE MAINNET - Proper Upgrade Strategy Required

**Current Problem:**
- No `version` field in accounts
- No migration logic
- Breaking changes force users to "close and re-register" (unacceptable for mainnet)

**Required for Production:**

1. **Add Version Field** (breaking change - do before mainnet):
```rust
#[account]
pub struct UserProfile {
    pub version: u8,  // ← Add this!
    pub owner: Pubkey,
    pub display_name: String,
    pub avatar_type: AvatarType,
    pub avatar_data: String,
    pub encryption_public_key: [u8; 32],
}
```

2. **Multi-Version Client Deserializer:**
```typescript
function deserializeUserProfile(data: Buffer): UserProfile {
    const version = data.readUInt8(8);
    if (version === 1) return deserializeV1(data);
    if (version === 2) return deserializeV2(data);
    throw new Error('Unsupported version');
}
```

3. **Lazy Migration (Auto-Upgrade on Write):**
```rust
pub fn update_profile(ctx: Context<UpdateProfile>, ...) -> Result<()> {
    let profile = &mut ctx.accounts.user_profile;

    if profile.version == 1 {
        migrate_v1_to_v2(profile)?;
    }

    profile.display_name = new_name;
    Ok(())
}
```

**Mainnet Checklist:**
- [ ] Add `version: u8` to all account structs
- [ ] Implement multi-version deserializers (client)
- [ ] Add `migrate_profile` instruction with lazy upgrade
- [ ] Test migration path on devnet
- [ ] Remove/restrict `close_profile` (or make admin-only)
- [ ] Never break existing user accounts

**References:**
- Solana account versioning: https://book.anchor-lang.com/anchor_references/account_types.html
- Metaplex metadata versioning (good example): https://github.com/metaplex-foundation/metaplex-program-library

---

## Program Deployment Workflow

After making changes to the Solana program, follow these steps:

### 1. Build and Deploy
```bash
# From project root (/Users/ash/Mukon-messenger)
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Extract Discriminators
After deployment, run the automatic discriminator extraction script:

```bash
# From project root
node scripts/update-discriminators.js
```

This script:
- Reads the IDL from `target/idl/mukon_messenger.json`
- Extracts all 8-byte instruction discriminators
- Automatically updates `app/src/utils/transactions.ts`
- Shows you what changed

**Manual Alternative** (if script fails):
```bash
# Parse IDL to see discriminators
anchor idl parse -f target/idl/mukon_messenger.json

# Then manually copy the discriminator bytes into transactions.ts DISCRIMINATORS object
```

### 3. Rebuild Client
```bash
cd app
npm run build  # Regular build
# or npm run build:clean if needed
```

### 4. Test on Device
```bash
adb install -r app-debug.apk
```

**What are discriminators?**
- 8-byte instruction identifiers (first 8 bytes of `sha256("global:instruction_name")`)
- Tell the Solana program which instruction to execute
- Computed by Anchor during `anchor build`
- Must match between client and program or transactions fail

---

## Current Status (as of 2026-01-28)

### ✅ DM MVP COMPLETE - Now Implementing Group Chat!

**What's Deployed:**
- NEW Solana program on devnet: `GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj`
- **DM Instructions:** register (with encryption key), invite, accept, reject, update_profile, block, unblock, close_profile
- **Group Instructions:** create_group, update_group, invite_to_group, accept_group_invite, reject_group_invite, leave_group, kick_member
- Backend WebSocket server running on 192.168.1.33:3001 (host IP for physical device)

**What's Working:**

**Core Messaging:**
- ✅ Solana Mobile Wallet Adapter (MWA) integration
- ✅ Manual transaction construction (no Anchor SDK in app - React Native compatible!)
- ✅ User registration with encryption public key stored on-chain
- ✅ Contact invitation/accept/reject flow
- ✅ **Contact blocking/unblocking system** - Prevents harassment, can unblock later
- ✅ **Symmetric contact deletion** - Both users see contact removed, can re-invite
- ✅ E2E encrypted messaging using NaCl box (asymmetric encryption)
- ✅ Messages encrypted with recipient's public key + sender's secret key
- ✅ Backend only sees encrypted blobs (true E2E encryption)
- ✅ Message persistence: Messages load from backend on chat screen mount
- ✅ Real-time message delivery via Socket.IO
- ✅ **Telegram-style message deletion** - Delete for self OR delete for everyone (sender only)
- ✅ One-time encryption key derivation in same MWA session as wallet connect
- ✅ Duplicate message detection (matches by encrypted+nonce+sender)
- ✅ Decryption of both incoming and own messages from backend history
- ✅ **MessengerContext architecture** - ONE socket instance, shared encryption keys, centralized state

**Message Interactions (Jan 24):**
- ✅ **Reply to messages** - Quote messages with preview in chat
- ✅ **Message reactions** - 6 quick emojis (❤️ 🔥 💯 😂 👍 👎)
- ✅ **Telegram-style quick react bar** - Short press shows floating emoji row
- ✅ **Reaction toggle behavior** - One reaction per user, click same emoji to remove
- ✅ **Separated touch handlers** - Short press (quick react) vs long press (full menu)
- ✅ **Copy message** - Copy text to clipboard (expo-clipboard)
- ✅ **Pin message** - Placeholder for future implementation
- ✅ **Enhanced delete menu** - Submenu with "Delete for Me" / "Delete for Everyone"
- ✅ **Reorganized menu** - React → Reply → Copy → Pin → Delete

**Avatars & Profile (Jan 24):**
- ✅ **Emoji avatars** - 200+ curated emojis for user profiles
- ✅ **Avatar in chat** - Shows next to incoming messages (Telegram-style)
- ✅ **Avatar in chat header** - Displays next to contact name in header bar
- ✅ **Avatar in drawer** - Profile section shows emoji and username
- ✅ **Avatar in contacts list** - Shows in all contact states
- ✅ **UTF-16 emoji fix** - Proper character counting with Array.from()
- ✅ **Always-editable username** - Update display name anytime in profile
- ✅ **Tap to change avatar** - Emoji picker in profile screen

**Contact Management (Jan 24):**
- ✅ **.sol/.skr domain resolution** - Add contacts by domain name (needs mainnet testing)
- ✅ **Contact custom names** - Local storage via AsyncStorage
- ✅ **Contact name syncing** - useFocusEffect refreshes across screens
- ✅ **Domain caching** - Faster lookups for resolved domains
- ✅ **Manual SNS implementation** - React Native compatible (js-sha256)
- ✅ **Name priority:** Custom name > Domain > On-chain name > Pubkey
- 🔜 **Future:** Move custom names on-chain for cross-device sync (post-hackathon)

**Group Chat (Jan 26):**
- ✅ **Create groups** - Up to 30 members, optional token gating
- ✅ **Group invitations** - Invite contacts to groups, accept/reject flow
- ✅ **Token gating** - SPL token balance verification for group access
- ✅ **Group management** - Admin can kick members, members can leave
- ✅ **Group encryption** - Symmetric encryption with NaCl secretbox
- ✅ **Unified conversations** - DMs and Groups in single list with filter chips
- ✅ **Settings screen** - Account management, close_profile for devnet iteration
- ✅ **Automatic discriminator extraction** - Script updates client after program deployment

**Recent Major Refactor (Jan 20):**
- Created `MessengerContext` to centralize socket/encryption/state management
- Eliminates multiple socket instances (one per screen → ONE for entire app)
- Eliminates duplicate authentications and wallet prompts
- Shared encryption keys across all components
- Centralized message state with proper deduplication
- Fixed critical decryption bug: ChatScreen now correctly determines recipient for incoming vs outgoing messages

**Architecture:**
- `app/src/contexts/MessengerContext.tsx` - Centralized messenger logic (socket, encryption, state)
- `app/src/contexts/WalletContext.tsx` - Wallet connection via MWA
- `app/src/utils/transactions.ts` - Manual transaction builders (no Anchor SDK)
- `app/src/utils/encryption.ts` - NaCl encryption utilities
- All screens now use `useMessenger()` hook from MessengerContext

**Testing Flow:**
1. Connect wallet (derives encryption keys once)
2. Register user (stores encryption public key on-chain)
3. Add contacts (send/accept invitations)
4. Send encrypted messages (E2E encrypted, backend only sees blobs)
5. Both users can decrypt messages using conversation partner's encryption public key

**Known Issues Fixed:**
1. ✅ **Too many wallet verification prompts** - FIXED with MessengerContext (Jan 20)
2. ✅ **Second wallet decryption problems** - FIXED with correct recipient determination (Jan 20)
3. ✅ **Socket.IO connection timeout** - FIXED with transport order matching backend (Jan 20)
4. ✅ **Contact management** - FIXED with block/unblock + symmetric deletion (Jan 20)
5. ✅ **Message deletion** - FIXED with Telegram-style delete for self/everyone (Jan 20)
6. ✅ **ConstraintSpace error on registration** - FIXED: close_profile now closes BOTH UserProfile and WalletDescriptor (Jan 28)
7. ✅ **NotRequested error when accepting invitations** - FIXED: register now preserves pending invitations (Jan 28)

**Critical Fixes (Jan 28):**

**Issue 1: ConstraintSpace Error During Re-registration**
- **Problem:** close_profile only closed UserProfile, left 77-byte WalletDescriptor on-chain
- **Result:** Re-registration failed with "ConstraintSpace. Left: 3344, Right: 77"
- **Fix:** Updated close_profile instruction to close BOTH accounts and return full rent
- **Impact:** Clean re-registration flow for devnet development

**Issue 2: NotRequested Error When Accepting Invitations**
- **Problem:** register instruction unconditionally set `wallet_descriptor.peers = vec![]`
- **Result:** Invitations sent before target registered were erased during registration
- **Fix:** register now checks if WalletDescriptor exists (owner != default) and preserves peers
- **Impact:** Invite-before-register flow now works correctly

**Critical Fixes - Session 2 (Jan 28 Evening):**

**Issue 3: Profile Update Discriminator Typo**
- **Problem:** `transactions.ts` line 287 used `DISCRIMINATORS.updateProfile` (camelCase) but key is `update_profile` (underscore)
- **Error:** "Cannot read property 'length' of undefined"
- **Fix:** Changed to `DISCRIMINATORS.update_profile` + updated ProfileScreen to pass all 3 args to updateProfile()
- **Files:** `app/src/utils/transactions.ts`, `app/src/screens/ProfileScreen.tsx`

**Issue 4: Add Members Button Missing**
- **Problem:** `wallet` not exposed in MessengerContext, so `isAdmin` check always false
- **Fix:** Added `wallet: WalletContextType | null` to interface and value object
- **Impact:** GroupInfoScreen can now check if user is admin/member
- **Files:** `app/src/contexts/MessengerContext.tsx`

**Issue 5: DM Decryption Failing**
- **Problem:** UserProfile deserialization MISSING `avatar_type` byte (1 byte enum between display_name and avatar_data)
- **Error:** "Failed to decrypt message" + encryption keys starting with `00`
- **Root Cause:** All fields after display_name read at wrong offset, encryption keys were garbage
- **Fix:** Added `avatar_type` byte read in loadContacts() and loadProfile()
- **Files:** `app/src/contexts/MessengerContext.tsx` (lines 847, 909)
- **Impact:** CRITICAL - DM decryption now works correctly

**Issue 6: Group Key Distribution Missing**
- **Problem:** Group keys only shared via socket when invitee is online, no persistence for offline users
- **Error:** "Group key not found - cannot encrypt message"
- **Fix (Backend):** Added `pendingKeyShares` storage, `request_group_key` handler
- **Fix (Client):** Call `socket.emit('request_group_key')` after accepting invite
- **Files:** `backend/src/index.js`, `app/src/contexts/MessengerContext.tsx`
- **Impact:** Invitees can receive group keys even if offline when invited

**Group Invite Policy Change (Jan 28):**
- **OLD:** Only admin (creator) can invite members
- **NEW:** ANY member can invite, only admin can kick
- **Rationale:** More social/organic growth, reduces friction, matches casual group chat UX (WhatsApp/Telegram)
- **Security:** Token gating still enforced on-chain in accept_group_invite, 30 member cap prevents spam
- **Program Change:** `invite_to_group` now checks `group.members.contains()` instead of `group.creator ==`
- **UI Change:** GroupInfoScreen shows "Invite Members" to all members (checks `isMember` not `isAdmin`)
- **Files:** `programs/mukon-messenger/src/lib.rs` (line 456-462), `app/src/screens/GroupInfoScreen.tsx`

**Remaining Known Issues:**
1. **Program needs rebuild/redeploy** - invite_to_group logic changed, requires `anchor build && anchor deploy` (Jan 28)
2. **Group creators can't see their groups** - loadGroups() only queries GroupInvite accounts, but creators are added directly to Group.members (identified Jan 28)
3. **Group creation requires multiple transactions** - Current: create_group (1 tx) + invite per member (N txs), desired: single batched transaction (identified Jan 28)
4. **Wallet connection persistence** - Closing/reopening app requires full reconnect
5. **Backend message persistence** - Currently in-memory only, need SQLite/Redis
6. **Domain resolution verification** - Code implemented but needs testing on mainnet with real domains
7. **Group key rotation** - Currently only rotates on kick, should rotate on all member changes (security debt)

**Next Steps:**
1. ✅ ~~Test messaging between wallets~~ - WORKING!
2. ✅ ~~Add contact blocking/unblocking~~ - COMPLETE!
3. ✅ ~~Add message deletion~~ - COMPLETE!
4. ✅ ~~Add block/unblock UI buttons~~ - COMPLETE!
5. ✅ ~~Add Telegram-style sidebar navigation~~ - COMPLETE!
6. ✅ ~~Add .sol/.skr domain name resolution~~ - COMPLETE!
7. ✅ ~~Add emoji avatars~~ - COMPLETE!
8. ✅ ~~Add message reactions~~ - COMPLETE!
9. ✅ ~~Add reply to message~~ - COMPLETE!
10. ✅ ~~Fix avatar display bugs~~ - COMPLETE!
11. ✅ ~~Add reaction toggle behavior~~ - COMPLETE!
12. ✅ ~~GROUP CHAT ARCHITECTURE~~ - Design complete (see section below)
13. ✅ ~~GROUP CHAT IMPLEMENTATION~~ - All 7 instructions deployed, UI screens built, backend ready (Jan 26)
14. ✅ ~~Fix profile update bugs~~ - COMPLETE (Jan 28)
15. ✅ ~~Fix DM decryption (avatar_type byte)~~ - COMPLETE (Jan 28)
16. ✅ ~~Fix group key distribution~~ - COMPLETE (Jan 28)
17. ✅ ~~Allow members to invite (not just admin)~~ - COMPLETE (Jan 28)
18. 🔄 **Rebuild/redeploy program** - Need to deploy invite_to_group change
19. 🔄 **Test all fixes end-to-end** - Profile, DMs, Groups (Jan 29)
20. 🔄 **ARCIUM INTEGRATION** - Encrypt contact lists + groups on-chain ($10k bounty) - **NEXT PRIORITY**
21. 🔜 Test group chat E2E (create, invite, message, token gating)
22. 🔜 Test domain resolution on mainnet with real .sol/.skr domains
23. 🔜 Add wallet connection persistence (AsyncStorage)
24. 🔜 Add backend message persistence (SQLite or Redis)
25. 🔜 Polish UI/UX (loading states, error messages)
26. 🔜 Deploy backend to Fly.io for production

## What We're Building

A 1:1 encrypted messenger (like Line/WeChat DMs) where:
1. Wallet address = identity (no phone number)
2. Contact list is encrypted on-chain (Arcium)
3. Messages are E2E encrypted (NaCl/TweetNaCl)
4. Message content stored off-chain (simple backend)
5. Only metadata/pointers on-chain

## Technical Architecture

### Current Architecture (MVP - Jan 20, 2026)
```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React Native)                    │
│  - Solana Mobile Wallet Adapter (MWA)                       │
│  - E2E encryption (NaCl box - asymmetric)                   │
│  - MessengerContext (centralized socket/state)              │
│  - Chat UI                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               SOLANA PROGRAM (Anchor + Arcium)              │
│  Program ID: GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj  │
│                                                             │
│  Accounts:                                                  │
│  ├── UserProfile (display name, avatar, encryption pubkey)  │
│  ├── WalletDescriptor (peer relationships)                  │
│  └── Conversation (metadata, participants)                  │
│                                                             │
│  Instructions:                                              │
│  ├── register() - Create user profile + encryption key      │
│  ├── invite(peer) - Send contact request                    │
│  ├── accept(peer) - Accept request, create conversation     │
│  ├── reject(peer) - Reject request OR delete contact        │
│  ├── block(peer) - Hard block (prevents re-invites)         │
│  ├── unblock(peer) - Change Blocked → Rejected              │
│  └── update_profile() - Update profile                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  MESSAGE BACKEND (WebSocket)                │
│  - Socket.IO for real-time delivery                         │
│  - Store encrypted message blobs                            │
│  - Wallet signature authentication                          │
│  - Message deletion (delete for self or everyone)           │
│  - Running on 192.168.1.33:3001                             │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture (With Full Arcium - Hackathon Submission)
```
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 3: CLIENT (End-to-End)                │
├─────────────────────────────────────────────────────────────┤
│  - NaCl box encryption (message content)                    │
│  - Arcium MPC queries (encrypted contact list access)       │
│  - Zero-knowledge proofs (relationship verification)        │
│  - Local metadata decryption only                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              LAYER 2: OFF-CHAIN (Relay Nodes)               │
├─────────────────────────────────────────────────────────────┤
│  What relay sees:                                           │
│  ├── Encrypted message blob (can't read)                    │
│  ├── Destination: [ENCRYPTED PUBKEY or anonymous ID]        │
│  └── Timestamp (ordering only)                              │
│                                                             │
│  → Relay can't see sender/recipient identities              │
│  → Relay can't correlate conversations                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           LAYER 1: ON-CHAIN (Arcium MPC Encryption)         │
├─────────────────────────────────────────────────────────────┤
│  Encrypted with Arcium:                                     │
│  ├── Contact lists (who you talk to)                        │
│  ├── Conversation existence (that a chat exists)            │
│  ├── Message pointers (off-chain blob references)           │
│  ├── User profiles (display names, avatars)                 │
│  └── Social graph (entire relationship network)             │
│                                                             │
│  → Even developers can't see who talks to whom              │
│  → On-chain observers only see encrypted blobs              │
│  → MPC proves relationships without revealing data          │
└─────────────────────────────────────────────────────────────┘
```

**Privacy Goals:**
- 🔒 Message content encrypted (E2E with NaCl)
- 🔒 Contact lists encrypted (Arcium MPC)
- 🔒 Social graph encrypted (Arcium MPC)
- 🔒 Conversation metadata encrypted (Arcium MPC)
- 🔒 Message routing anonymized (encrypted destination IDs)
- 🔒 Relay nodes can't correlate conversations
- 🔒 On-chain observers can't map social networks
- 🔒 Zero-knowledge relationship proofs

**Attack Resistance:**
- Traffic analysis attacks → Blocked (anonymous routing)
- Social graph mapping → Blocked (Arcium encryption)
- Metadata leakage → Minimized (only existence of activity visible)
- Network analysis → Blocked (encrypted on-chain data)

**This is MAXIMUM privacy for the hackathon!** 🏆

## Directory Structure

```
mukon-messenger/
├── programs/
│   └── mukon-messenger/
│       ├── src/
│       │   └── lib.rs          # Anchor program with Arcium
│       └── Cargo.toml
├── encrypted-ixs/              # Arcium confidential instructions
│   ├── add_contact.rs
│   ├── update_profile.rs
│   └── ...
├── app/                        # React Native client
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useMukonMessenger.ts
│   │   │   └── useEncryption.ts
│   │   ├── screens/
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── ContactsScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── components/
│   │       ├── MessageBubble.tsx
│   │       └── ContactCard.tsx
│   └── package.json
├── backend/                    # Simple message relay
│   ├── src/
│   │   ├── index.ts
│   │   ├── websocket.ts
│   │   └── auth.ts
│   └── package.json
├── tests/
│   └── mukon-messenger.ts
├── logo.jpg                    # Project logo
├── icon.png                    # App icon
├── Anchor.toml
└── Cargo.toml
```

## Key Implementation Details

### 1. Deterministic Chat Hash (from STEM Proto)
```rust
fn get_chat_hash(a: Pubkey, b: Pubkey) -> [u8; 32] {
    let (first, second) = if a < b { (a, b) } else { (b, a) };
    let mut hasher = Sha256::new();
    hasher.update(first.to_bytes());
    hasher.update(second.to_bytes());
    hasher.finalize().into()
}
```

### 2. E2E Encryption (Client-side)
```typescript
// Use TweetNaCl for message encryption
import nacl from 'tweetnacl';
import { deriveEncryptionKeypair } from './utils';

// Derive encryption keypair from wallet signature
const getEncryptionKeys = async (wallet: WalletContextState) => {
    const message = "Sign to derive encryption keys for Mukon Messenger";
    const signature = await wallet.signMessage(Buffer.from(message));
    return deriveEncryptionKeypair(signature);
};

// Encrypt message for recipient
const encryptMessage = (
    content: string,
    recipientPubkey: Uint8Array,
    senderSecretKey: Uint8Array
): { encrypted: string; nonce: string } => {
    const nonce = nacl.randomBytes(24);
    const sharedKey = nacl.box.before(recipientPubkey, senderSecretKey);
    const encrypted = nacl.box.after(
        Buffer.from(content, 'utf8'),
        nonce,
        sharedKey
    );
    return {
        encrypted: Buffer.from(encrypted).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64'),
    };
};
```

### 3. Arcium Encrypted Contact List
```rust
// encrypted-ixs/contact_operations.rs
use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    pub struct ContactEntry {
        pubkey: [u8; 32],
        status: u8,  // 0=pending, 1=accepted, 2=rejected, 3=blocked
    }

    pub struct ContactList {
        contacts: Vec<ContactEntry>,
    }

    #[instruction]
    pub fn check_is_contact(
        list: Enc<Shared, ContactList>,
        query: Enc<Shared, [u8; 32]>
    ) -> Enc<Shared, bool> {
        let contacts = list.to_arcis();
        let target = query.to_arcis();

        let is_contact = contacts.contacts.iter()
            .any(|c| c.pubkey == target && c.status == 1);

        list.owner.from_arcis(is_contact)
    }
}
```

## Bounty Targets

### Primary: Arcium ($10,000)
- **Best integration into existing app: $3k** - Integrate into Mukon ecosystem
- **Most <encrypted> potential: $1k x 2** - Vision for DePIN messaging

### Secondary: Open Track ($18,000)
- Privacy messenger fits perfectly
- Supported by Light Protocol

### Stretch: ShadowWire/Radr Labs ($15,000)
- Add private payment splits in chat
- "Send $5 privately to everyone"

### Easy: Helius ($5,000)
- Just use their RPC

## Testing Checklist

- [ ] User can register with encrypted profile
- [ ] User can send contact invitation
- [ ] Recipient sees invitation and can accept/reject
- [ ] Accepted contacts can exchange encrypted messages
- [ ] Contact list is encrypted on-chain (verify with Arcium)
- [ ] Messages cannot be read by third parties
- [ ] Works on mobile (Android at minimum)

## Resources

- Arcium Docs: https://docs.arcium.com/developers
- Arcium Examples: https://github.com/arcium-hq/examples
- STEM Proto (fork reference): https://github.com/cherrydotfun/stem-proto
- Solana Privacy Hack: https://solana.com/privacyhack
- TweetNaCl.js: https://github.com/nicktomlin/tweetnacl-js

## CRITICAL UX FEATURE: Invite Unregistered Users

**Problem:** Every social app needs to let users invite friends who haven't joined yet. Requiring both users to register first is terrible UX.

**Solution:** The `invite` instruction uses `init_if_needed` on `invitee_descriptor`:
- If invitee hasn't registered: Creates their WalletDescriptor with the invitation waiting
- If invitee has registered: Adds to their existing WalletDescriptor
- When invitee registers later, they see pending invitations and can accept/reject

**Implementation (programs/mukon-messenger/src/lib.rs lines 302-309):**
```rust
#[account(
    init_if_needed,
    payer = payer,
    space = 8 + 32 + 4 + 100 * (32 + 1),  // Space for ~100 contacts
    seeds = [b"wallet_descriptor", invitee.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
    bump
)]
pub invitee_descriptor: Account<'info, WalletDescriptor>,
```

And initialization logic (lines 100-104):
```rust
// Initialize invitee_descriptor if it's a new account
if invitee_descriptor.owner == Pubkey::default() {
    invitee_descriptor.owner = invitee.key();
    invitee_descriptor.peers = vec![];
}
```

**Why This Matters:** Users can share their wallet address and invite friends immediately. When friends register, invitations are already waiting. This matches web2 UX expectations.

## RECENT FIXES (Jan 20, 2026)

### ✅ FIXED: Multiple Socket Instances & Constant Auth Prompts

**Problem (Jan 19):**
- Each screen (ContactsScreen, ChatScreen, AddContactScreen) created its own socket instance
- Multiple `useMukonMessenger` instances = multiple authentications
- User prompted to sign wallet message on every screen navigation
- Made app unusable

**Solution (Jan 20):**
- Created `MessengerContext` to centralize socket/encryption/state
- ONE socket instance for entire app (created in context provider)
- ONE authentication on wallet connect
- Shared encryption keys across all components
- All screens now use `useMessenger()` hook from context

**Files Changed:**
- Created: `app/src/contexts/MessengerContext.tsx`
- Updated: `app/App.tsx` (wrapped navigator with MessengerProvider)
- Updated: `app/src/screens/ChatScreen.tsx`, `ContactsScreen.tsx`, `AddContactScreen.tsx`

### ✅ FIXED: Second Wallet Decryption Failure

**Problem (Jan 19):**
- Second wallet sent messages but couldn't decrypt them
- Messages disappeared when leaving/re-entering chat
- Backend loaded 3 messages but 4 were sent (missing messages)

**Root Cause:**
ChatScreen always used `contact.pubkey` as recipient when decrypting, even for incoming messages:
```typescript
// WRONG - always uses contact as recipient
const recipientPubkey = new PublicKey(contact.pubkey);
```

**Solution (Jan 20):**
Correctly determine recipient based on who sent the message:
```typescript
// CORRECT - recipient is the OTHER person in conversation
const recipientPubkey = isMe
  ? new PublicKey(contact.pubkey)  // You sent it → recipient is contact
  : wallet.publicKey!;              // They sent it → recipient is you
```

**Result:** Both wallets can now decrypt all messages correctly!

### ✅ FIXED: Backend URL for Physical Device

**Problem:** App was using emulator address `http://10.0.2.2:3001` which doesn't work for physical device over ADB/WiFi.

**Solution:** Changed to actual host machine IP: `http://192.168.1.33:3001` in MessengerContext.

**Note:** Backend IP may change based on network. Check with `ifconfig` if connection issues occur.

### Current Message Flow (Working as of Jan 20):

1. User types message in ChatScreen
2. `sendMessage()` encrypts with NaCl box using recipient's public key
3. Socket emits `send_message` with encrypted payload
4. Backend receives and broadcasts to conversation room
5. Recipient's socket receives `new_message` event
6. Message decrypted with correct recipient key and displayed
7. Both sender and recipient can view message history (properly encrypted/decrypted)

**Status:** ✅ E2E encrypted messaging working end-to-end!

### ✅ NEW: Contact Blocking & Message Deletion (Jan 20 Continued)

**Problem:** Needed full contact management system matching modern messaging apps (Telegram/Signal/WhatsApp).

**Solution - Contact Blocking System:**

1. **Added PeerState::Blocked to Solana program:**
```rust
pub enum PeerState {
    Invited = 0,
    Requested = 1,
    Accepted = 2,
    Rejected = 3,
    Blocked = 4,  // NEW
}
```

2. **Updated invite() to check for blocked users:**
- Blocks re-invites from blocked contacts
- Allows re-inviting Rejected contacts (delete → re-add flow)

3. **Updated reject() to allow deleting accepted contacts:**
- Previously only worked for pending invites
- Now supports symmetric contact deletion (both users see contact removed)

4. **Added block() instruction:**
- Symmetric operation (sets both users to Blocked)
- Prevents any future invitations until unblocked
- Stops harassment/spam

5. **Added unblock() instruction:**
- Changes Blocked → Rejected (allows re-invite after unblock)
- Not immutable - users can change their minds

**Solution - Message Deletion System (Telegram-style):**

1. **Backend delete_message handler (backend/src/index.js):**
```javascript
socket.on('delete_message', ({ conversationId, messageId, deleteForBoth }) => {
  if (deleteForBoth) {
    // Delete from backend storage
    const msgs = messages.get(conversationId) || [];
    const filtered = msgs.filter(m => m.id !== messageId);
    messages.set(conversationId, filtered);

    // Broadcast deletion to everyone in room
    io.to(conversationId).emit('message_deleted', { conversationId, messageId });
  }
  // If false, client handles local deletion only
});
```

2. **Client deleteMessage() function (MessengerContext.tsx):**
- Delete for self: Removes from local state only
- Delete for everyone: Emits to backend, backend broadcasts to all clients

3. **UI with long-press menu (ChatScreen.tsx):**
- Long-press any message bubble to show delete menu
- "Delete for Me" always available
- "Delete for Everyone" only shown if user is the sender
- Uses react-native-paper Menu component

**Files Changed:**
- Updated: `programs/mukon-messenger/src/lib.rs` (block/unblock instructions)
- Updated: `app/src/utils/transactions.ts` (block/unblock builders)
- Updated: `app/src/contexts/MessengerContext.tsx` (blockContact, unblockContact, deleteMessage)
- Updated: `backend/src/index.js` (delete_message handler)
- Updated: `app/src/screens/ChatScreen.tsx` (message deletion UI)

**Architecture Decisions:**
- **Symmetric operations:** All contact management affects both users (simpler UX)
- **Telegram-style deletion:** User chooses delete scope, only sender can delete for everyone
- **Mutable blocking:** Users can unblock (Blocked → Rejected), then re-invite if desired

**Status:** ✅ Full contact management + message deletion working! Ready for testing.

### ✅ NEW: Telegram-Style Sidebar Navigation (Jan 20 Night)

**Problem:** Need proper app navigation structure. Decided between WhatsApp (tabs + 3 dots), Signal (minimalist), or Telegram (sidebar).

**Decision: Full Telegram Style**

**Why Telegram for crypto:**
- Power users expect feature-rich apps (like crypto wallets/DEXs)
- Wallet integration needs prominence (profile = wallet = identity)
- Lots of future features need a home (NFT gallery, send tokens, .sol domains)
- Contacts deserve dedicated space (verified wallets are valuable in crypto)
- Sidebar becomes "crypto command center"

**Implementation:**

1. **Installed @react-navigation/drawer:**
   - Added drawer navigation with react-native-gesture-handler
   - Nested Stack navigator inside Drawer (modal screens like Chat, AddContact, Profile)

2. **Created CustomDrawer component (app/src/components/CustomDrawer.tsx):**
   ```typescript
   // Profile section at top
   - Avatar icon
   - Wallet address (truncated)
   - Tap to open full profile

   // Navigation items
   - Chats (main screen)
   - Contacts
   - Saved Messages (placeholder)
   - Settings (placeholder)
   - Invite Friends (placeholder)
   ```

3. **Updated navigation structure (App.tsx):**
   - Main: DrawerNavigator (with hamburger menu)
   - Nested: StackNavigator for modal screens
   - GestureHandlerRootView wrapper for drawer gestures

4. **UI Updates:**
   - Removed profile FAB from ContactsScreen (now in drawer)
   - Hamburger icon in top-left opens drawer
   - Drawer slides from left (Telegram-style)
   - Dark theme matching Mukon brand

**Files Changed:**
- Created: `app/src/components/CustomDrawer.tsx`
- Updated: `app/App.tsx` (drawer navigation structure)
- Updated: `app/src/screens/ContactsScreen.tsx` (removed profile FAB)
- Updated: `package.json` (@react-navigation/drawer added)

**Future Sidebar Additions:**
- NFT Gallery
- Send Tokens
- .sol Domain Manager
- Transaction History
- Wallet Settings

**Status:** ✅ Telegram-style sidebar implemented! Ready for testing.

### ✅ NEW: Build System Improvements (Jan 24)

**Problem:** Need safe, tiered build options - avoid "nuclear option" (expo prebuild --clean) unless absolutely necessary.

**Solution - Three-Tier Build System:**

1. **Regular build** - `npm run build`
   - Fast, for JS/TS changes only
   - No gradle clean, no prebuild
   - 99% of development work

2. **Gradle clean build** - `npm run build:clean`
   - Surgical native cleanup
   - For native module changes, build errors
   - Safer than full prebuild

3. **Prebuild clean** - `npm run build:prebuild`
   - Nuclear option - regenerates /android and /ios
   - Only for: app.json changes, config plugins, major Expo upgrades
   - ⚠️ Deletes native folders entirely

**Implementation:**

1. **Created build-apk.sh script:**
   - Takes build type (debug/release) and optional "clean" flag
   - Runs gradle clean if requested
   - Copies APK to app/ folder with clean name
   - Shows file size and install command

2. **Updated package.json with clear scripts:**
   ```json
   "build": "./build-apk.sh debug",
   "build:clean": "./build-apk.sh debug clean",
   "build:prebuild": "npx expo prebuild --clean && ./build-apk.sh debug"
   ```

3. **Created BUILD.md documentation:**
   - Decision tree for which build to use
   - Warnings about prebuild --clean
   - Troubleshooting guide
   - When to escalate from build → clean → prebuild

**Files Changed:**
- Created: `app/build-apk.sh` (unified build script)
- Created: `app/BUILD.md` (comprehensive build guide)
- Updated: `app/package.json` (6 new build scripts)

**Why This Matters:**
- Prevents accidental native folder deletion
- Clear escalation path when builds break
- Documented for future reference
- Safe for Mukon (minimal native code), dangerous for apps with custom native modules

**Status:** ✅ Build system documented and safe!

### ✅ NEW: Message Reactions, Replies, and Emoji Avatars (Jan 24)

**Problem:** Need modern messaging features to compete with Telegram/WhatsApp/Signal - reactions, replies, avatars.

**Solution - Message Reactions:**

1. **Backend reaction storage (backend/src/index.js):**
```javascript
socket.on('add_reaction', ({ conversationId, messageId, emoji, userId }) => {
  const message = msgs.find(m => m.id === messageId);
  if (!message.reactions) message.reactions = {};
  if (!message.reactions[emoji]) message.reactions[emoji] = [];
  if (!message.reactions[emoji].includes(userId)) {
    message.reactions[emoji].push(userId);
  }
  io.to(conversationId).emit('reaction_updated', { conversationId, messageId, reactions: message.reactions });
});
```

2. **Telegram-style quick react bar:**
   - Long-press message shows floating emoji row (❤️ 🔥 💯 😂 👍 👎)
   - Tap emoji = instant reaction
   - Full emoji picker still available via menu
   - Reactions display below message in small bubbles with counts

**Solution - Reply to Messages:**

1. **Reply reference in message structure:**
   - Messages store `replyTo` field (message ID being replied to)
   - Backend stores and broadcasts reply references
   - Client decrypts both original and replied messages

2. **Reply preview UI:**
   - Input area shows quoted message preview when replying
   - Message bubbles show quoted text above content
   - Styled with left border and italic text (Telegram-style)

**Solution - Emoji Avatars:**

1. **EmojiPicker component (200+ emojis):**
   - Faces, animals, objects, food, activities, symbols
   - Grid layout with Portal/Dialog
   - Tap to select, updates profile immediately

2. **Avatar display locations:**
   - Profile screen: Tap large avatar to change
   - Chat screen: Small avatar next to incoming messages (Telegram-style)
   - Drawer menu: Avatar above username and wallet address
   - Contacts list: Avatar in all contact states (pending, accepted, blocked)

3. **Username editing:**
   - Always-editable TextInput in profile
   - No "edit mode" toggle - just type and save
   - "Update Username" button saves to on-chain profile
   - Displays in drawer above wallet address

**Solution - Enhanced Message Menu:**

1. **Reorganized menu order (Telegram-style):**
   - React (full emoji picker)
   - Reply (quote message)
   - Copy Message (to clipboard)
   - Pin Message (placeholder)
   - Delete (opens submenu)

2. **Delete submenu:**
   - "Delete for Me" - Always available
   - "Delete for Everyone" - Only shown to sender
   - Prevents accidental deletions

**Solution - Contact Renaming & Domain Resolution:**

1. **Local contact names:**
   - AsyncStorage stores custom names per pubkey
   - useContactNames hook loads names for all contacts
   - useFocusEffect refreshes names when navigating between screens

2. **Domain resolution (.sol/.skr):**
   - Manual SNS implementation (React Native compatible)
   - js-sha256 for domain hashing
   - Connects to mainnet for domain lookups
   - Caches resolved domains in AsyncStorage
   - Falls back to custom name > domain > on-chain name > pubkey

**Files Changed:**
- Created: `app/src/components/EmojiPicker.tsx` (200+ emoji grid)
- Created: `app/src/components/ReactionPicker.tsx` (8 quick reactions)
- Created: `app/src/hooks/useContactNames.ts` (contact name management)
- Created: `app/src/utils/domains.ts` (SNS resolution + custom names)
- Updated: `app/src/screens/ChatScreen.tsx` (reactions, replies, quick react bar, avatars)
- Updated: `app/src/screens/ProfileScreen.tsx` (always-editable username, emoji picker)
- Updated: `app/src/components/CustomDrawer.tsx` (avatar + username display)
- Updated: `app/src/contexts/MessengerContext.tsx` (replyTo support, reaction listeners)
- Updated: `backend/src/index.js` (reaction storage, reply references)
- Created: `app/build-apk.sh` (simplified build script)
- Created: `app/BUILD.md` (build documentation)

**Dependencies Added:**
- `expo-clipboard` - Copy message to clipboard
- `js-sha256` - Manual SNS domain hashing (React Native compatible)

**Architecture Decisions:**
- **Reactions stored as:** `{ "❤️": ["userId1", "userId2"], "🔥": ["userId3"] }`
- **Replies stored as:** Message ID reference in `replyTo` field
- **Avatars stored as:** Single emoji character in `avatarUrl` field (on-chain)
- **Custom names stored as:** AsyncStorage key `contact_custom_name_${pubkey}`
- **Domain cache stored as:** AsyncStorage key `domain_${pubkey}`

**Status:** ✅ Full Telegram-style messaging UI complete! Ready for Arcium integration.

### ✅ FIXED: Avatar Display & Reaction Toggle (Jan 24 Evening)

**Problem 1: Avatars not displaying anywhere**
- Emoji avatars weren't showing in drawer menu, chat messages, contacts list, or chat header
- Root cause: JavaScript `.length` property treats multi-byte emojis incorrectly
  - Example: `"🦅".length === 2` (WRONG - UTF-16 encoding)
  - Should be: `Array.from("🦅").length === 1` (CORRECT)

**Solution:**
- Replaced all `avatar.length === 1` checks with `Array.from(avatar).length === 1`
- Applied consistently across 4 locations:
  - `ChatScreen.tsx` - Message bubbles and header
  - `CustomDrawer.tsx` - Profile section
  - `ContactsScreen.tsx` - Contact list items

**Problem 2: Reaction system needs refinement**
- Users could react multiple times to same message
- No way to remove a reaction once added
- Reactions appeared on top of message text (unreadable)

**Solution - Reaction Toggle Logic (Backend):**
```javascript
const alreadyReacted = message.reactions[emoji]?.includes(userId);

if (alreadyReacted) {
  // Remove reaction (toggle off)
  message.reactions[emoji].splice(index, 1);
} else {
  // Remove from all other reactions (one reaction per user)
  for (const [existingEmoji, users] of Object.entries(message.reactions)) {
    const index = users.indexOf(userId);
    if (index > -1) users.splice(index, 1);
  }
  // Add to new reaction
  message.reactions[emoji].push(userId);
}
```

**Solution - Reaction Positioning (Frontend):**
- Moved reactions outside `TouchableOpacity` component
- Now renders below message bubble instead of inside it
- Added `marginTop: -4` to slightly overlap bubble edge (Telegram-style)

**Problem 3: Touch handlers conflicting**
- Quick react bar and full menu both triggered on long press
- UX unclear - when to show emojis vs full menu

**Solution - Separated Touch Handlers:**
```typescript
<TouchableOpacity
  onPress={() => {
    // Short press - show ONLY emoji chip
    setQuickReactVisible(item.id);
    setMenuVisible(null);
  }}
  onLongPress={() => {
    // Long press - show ONLY menu
    setMenuVisible(item.id);
    setQuickReactVisible(null);
  }}
```

**Conditional Rendering:**
```typescript
{quickReactVisible === item.id && !menuVisible && (
  <View style={styles.quickReactBar}>
    {/* Quick emoji row */}
  </View>
)}

{menuVisible === item.id && (
  <Menu>
    {/* Full menu: React, Reply, Copy, Pin, Delete */}
  </Menu>
)}
```

**Problem 4: Backend changes not reflecting**
- Reaction updates weren't appearing because backend server wasn't restarted
- Important reminder: Node.js backend requires manual restart (no hot reload like Metro)

**Files Changed:**
- Updated: `app/src/screens/ChatScreen.tsx` (emoji length fix, touch handlers, reaction positioning, header avatar)
- Updated: `app/src/components/CustomDrawer.tsx` (emoji length fix)
- Updated: `app/src/screens/ContactsScreen.tsx` (emoji length fix in 4 locations)
- Updated: `backend/src/index.js` (reaction toggle logic)

**Architecture Decisions:**
- **One reaction per user per message** - Matches Telegram/WhatsApp behavior
- **Toggle to remove** - Clicking same emoji removes reaction
- **Reactions below text** - Prevents obscuring message content
- **Short vs long press** - Clear UX for quick react vs full menu

**Status:** ✅ Avatar display fixed everywhere! ✅ Reaction system polished! ✅ Ready for group chat architecture!

## 🚀 GROUP CHAT IMPLEMENTATION (Jan 26, 2026 - CURRENT FOCUS)

### Architecture Decisions Made

**Core Settings:**
- **Group ID:** Pure random 32 bytes (maximum privacy, no traces to creator)
- **Max Members:** 30 for MVP (can scale to thousands later)
- **Admin Model:** Creator = only admin for MVP (no multi-admin)
- **Visibility:** All group members can see each other's wallet addresses (encrypted from outsiders via Arcium)
- **Key Rotation:** Only on kicks (not on voluntary leaves) - security debt for MVP
- **Re-invites:** Users can be re-invited after rejecting (same as DM behavior)

**Token Gating:**
- Simple fungible token balance check on accept
- User passes their token account, program verifies `amount >= min_balance`
- NFT collection gating is post-MVP

**Avatar System Update:**
- Added `AvatarType` enum: `Emoji` (default) or `NFT`
- `avatar_data` field stores either emoji string or NFT mint address
- Client verifies NFT ownership before displaying

### New Solana Program Instructions

```
ON-CHAIN (7 new instructions):
├── create_group(group_id, name, encryption_pubkey, token_gate?)
├── update_group(group_id, name?, token_gate?)
├── invite_to_group(group_id, invitee)
├── accept_group_invite(group_id) — checks token gate
├── reject_group_invite(group_id)
├── leave_group(group_id)
└── kick_member(group_id, member) — creator only
```

### New Account Structures

```rust
#[account]
pub struct Group {
    pub group_id: [u8; 32],           // Random, client-generated
    pub creator: Pubkey,               // Can never be removed, only admin for MVP
    pub name: String,                  // Max 64 chars
    pub created_at: i64,
    pub members: Vec<Pubkey>,          // Max 30 for MVP
    pub encryption_pubkey: [u8; 32],   // For group key exchange
    pub token_gate: Option<TokenGate>, // Optional balance requirement
}

#[account]
pub struct GroupInvite {
    pub group_id: [u8; 32],
    pub inviter: Pubkey,
    pub invitee: Pubkey,
    pub status: GroupInviteStatus,     // Pending, Accepted, Rejected
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenGate {
    pub token_mint: Pubkey,
    pub min_balance: u64,
}
```

### Group Encryption Model (Off-Chain)

Messages are NOT stored on-chain. We use shared secret encryption:

```
1. CREATE GROUP
   - Creator generates random 32-byte group_secret
   - Stores locally (encrypted with their wallet keys)

2. INVITE MEMBER
   - Admin encrypts group_secret with invitee's encryption_public_key (NaCl box)
   - Sends encrypted key via backend Socket.IO event
   - Invitee decrypts and stores locally

3. SEND MESSAGE
   - Sender encrypts message with group_secret (NaCl secretbox)
   - Backend broadcasts to group room
   - All members decrypt with same group_secret

4. KICK MEMBER (Post-MVP: key rotation)
   - Generate new group_secret
   - Distribute to remaining members
   - Old messages still readable (had old key)
```

### Backend Socket.IO Events (To Implement)

```typescript
// Client → Server
'join_group_room': { groupId: string }
'leave_group_room': { groupId: string }
'group_message': { groupId: string, encryptedContent: string, nonce: string }
'group_key_share': { groupId: string, recipientPubkey: string, encryptedKey: string, nonce: string }

// Server → Client
'group_message': { groupId: string, senderPubkey: string, encryptedContent: string, nonce: string, timestamp: number }
'group_member_joined': { groupId: string, memberPubkey: string }
'group_member_left': { groupId: string, memberPubkey: string }
'group_member_kicked': { groupId: string, memberPubkey: string }
'group_key_shared': { groupId: string, senderPubkey: string, encryptedKey: string, nonce: string }
```

### ⚠️ NON-NEGOTIABLE: Arcium Encryption

Arcium encryption is NOT optional. Both DMs and Groups ship with encrypted membership lists for hackathon submission.

```
ARCIUM ENCRYPTS:
├── DMs: WalletDescriptor.peers[]
├── Groups: Group.members[]
└── Invites: GroupInvite.invitee

PATTERN:
- Same circuits work for both (is_accepted_contact → is_group_member)
- Members can see each other (decrypt with group key)
- Outsiders/blockchain observers see encrypted blobs only
```

### Implementation Timeline

| Day | Focus |
|-----|-------|
| 1 | Solana program: apply group code with fixes, deploy to devnet |
| 2 | Client: transaction builders, MessengerContext group methods |
| 3 | Backend: Socket.IO group events + UI: GroupsScreen, CreateGroupScreen |
| 4 | UI: GroupChatScreen, GroupInfoScreen + Arcium encrypted circuits |
| 5 | Arcium integration testing, full E2E testing on devnet |

### Files to Modify

| File | Changes |
|------|---------|
| `programs/mukon-messenger/src/lib.rs` | Replace with group code + security fix |
| `programs/mukon-messenger/Cargo.toml` | Add anchor-spl dependency |
| `app/src/utils/transactions.ts` | Update register, add 7 group builders |
| `app/src/contexts/MessengerContext.tsx` | Add group state/methods/socket handlers |
| `backend/src/index.js` | Add group message/key handlers |
| `app/App.tsx` | Add group screens to navigation |
| `app/src/components/CustomDrawer.tsx` | Add Groups menu item |
| `tests/mukon-messenger.ts` | Fix register calls, add group tests |

### New Screens to Create

| Screen | Purpose |
|--------|---------|
| `GroupsScreen.tsx` | List user's groups |
| `CreateGroupScreen.tsx` | Create group form |
| `GroupChatScreen.tsx` | Group chat interface |
| `GroupInfoScreen.tsx` | Group details, members, settings |
| `InviteMemberScreen.tsx` | Invite contacts to group |

### Critical Security Fix Needed

**Token account owner verification** in `accept_group_invite`:
```rust
// User's code checks mint and amount but NOT owner!
// Add this check to prevent using someone else's token account:
require!(
    token_account.owner == ctx.accounts.payer.key(),
    ErrorCode::InvalidTokenAccount
);
```

### Breaking Change: register() Signature

The new code changes `register()` to include `avatar_data`:
- **Old:** `register(display_name, encryption_public_key)`
- **New:** `register(display_name, avatar_data, encryption_public_key)`

**Client updates required:**
- `app/src/utils/transactions.ts` - `createRegisterInstruction()`
- `app/src/contexts/MessengerContext.tsx` - `register()` function
- `tests/mukon-messenger.ts` - All register() calls

## Testing Guidelines

### Manual E2E Testing Flow

**Prerequisites:**
- Both wallets must register on the NEW program (GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj)
- Backend running on 192.168.1.33:3001
- Metro running with cache clear: `npm start -- --reset-cache`

**Test Flow (Two Physical Devices):**
1. **Device 1 (Wallet A):**
   - Connect wallet → derives encryption keys once
   - Register user (encryption public key stored on-chain)
   - Copy wallet address

2. **Device 2 (Wallet B):**
   - Connect wallet → derives encryption keys
   - Register user
   - Copy wallet address

3. **Device 1 sends invitation:**
   - Add contact with Wallet B's address
   - Send invitation (on-chain tx)

4. **Device 2 accepts:**
   - See invitation from Wallet A
   - Accept invitation (on-chain tx)

5. **Exchange messages:**
   - Device 1: Send "Hey from A!"
   - Device 2: Receives encrypted message, decrypts correctly
   - Device 2: Send "Hey from B!"
   - Device 1: Receives and decrypts correctly

**Success Criteria:**
- Both wallets can send and receive messages
- Messages decrypt correctly on both ends
- No duplicate messages
- No constant wallet prompts
- Messages persist after leaving/re-entering chat

### Performance Expectations
- **Registration:** ~2-3 seconds (on-chain tx)
- **Invitation/Accept:** ~2-3 seconds (on-chain tx)
- **Message send:** <100ms (WebSocket)
- **Message receive:** Real-time (<50ms)

## Hackathon Submission Checklist

**CRITICAL - Before Final Submission:**
- [ ] **Remove CLAUDE.md** from repository (or add to .gitignore on submission branch)
  - **Reason:** Contains development notes and references to tools used
  - **Alternative:** Create submission branch, remove claude.md, push that branch
  - **Keep it locally** for continued development post-hackathon

**Architecture Decisions (Jan 20, 2026):**
- ✅ **STEM Proto:** Will NOT mention in public docs (code is substantially original)
- ✅ **Contact Management:** Implementing **Option B (Delete + Block)** after message testing
  - Delete = Soft (status: Rejected, can be re-invited)
  - Block = Hard (status: Blocked, cannot re-invite until unblocked)
  - Prevents harassment, matches user expectations (Signal/WhatsApp/Telegram all have this)

**Production Launch Plans:**
- 🚀 **GOING TO MAINNET!** App will launch on Solana Mobile around hackathon submission
- 🎯 **Backend Provider:** **Fly.io** (recommended for production messaging app)
  - Excellent WebSocket support
  - Edge deployment (low latency)
  - Production-grade infrastructure
  - Affordable ($5-10/month to start)
  - Easy scaling
- 📝 **See PRODUCTION_DEPLOY.md** for complete deployment guide

**Deployment Timeline:**
1. **Week 1 (Jan 20-23):** MVP + Arcium integration
2. **Week 2 (Jan 24-30):** Deploy to Fly.io + mainnet, submit hackathon
3. **Week 3+:** Add persistence, monitoring, launch on Solana Mobile

**Backend Deployment for Hackathon/Production:**
- ⚠️ **DO NOT hardcode IP address in README/submission** (changes with network location)
- ✅ **Deploy to Fly.io** for stable production URL
  - `https://mukon-backend.fly.dev` (or similar)
  - Works everywhere (emulator, physical device, judges' machines)
- ✅ **Make URL configurable** for dev/prod environments
  - Dev: `10.0.2.2:3001` (Android emulator) or `localhost:3001` (iOS)
  - Prod: `https://mukon-backend.fly.dev`

**TODO before mainnet launch:**
- [ ] Deploy backend to Fly.io
- [ ] Make backend URL configurable (dev vs prod)
- [ ] Deploy Solana program to mainnet-beta
- [ ] Add message persistence (Fly.io Postgres)
- [ ] Add monitoring (Sentry, UptimeRobot)
- [ ] Test extensively on mainnet
- [ ] Submit to Solana Mobile app store

## Git Commit Guidelines

**IMPORTANT:** Do not include Claude credits in commit messages. Keep commits professional and attribution-free.

**IMPORTANT:** Solo dev workflow - only push to remote at END of session. Commit frequently locally, but don't waste tokens pushing to remote after every commit.

## Project Assets

- `logo.jpg` - Project logo (already in repository)
- `icon.png` - App icon (already in repository)
