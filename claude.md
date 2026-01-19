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

## Current Status (as of 2026-01-20)

### ✅ MVP COMPLETE - Working E2E Encrypted Messenger!

**What's Deployed:**
- NEW Solana program on devnet: `DGAPfs1DAjt5p5J5Z5trtgCeFBWMfh2mck2ZqHbySabv`
- Program includes: register (with encryption key), invite, accept, reject, update_profile
- Backend WebSocket server running on 192.168.1.33:3001 (host IP for physical device)

**What's Working:**
- ✅ Solana Mobile Wallet Adapter (MWA) integration
- ✅ Manual transaction construction (no Anchor SDK in app - React Native compatible!)
- ✅ User registration with encryption public key stored on-chain
- ✅ Contact invitation/accept/reject flow
- ✅ E2E encrypted messaging using NaCl box (asymmetric encryption)
- ✅ Messages encrypted with recipient's public key + sender's secret key
- ✅ Backend only sees encrypted blobs (true E2E encryption)
- ✅ Message persistence: Messages load from backend on chat screen mount
- ✅ Real-time message delivery via Socket.IO
- ✅ One-time encryption key derivation in same MWA session as wallet connect
- ✅ Duplicate message detection (matches by encrypted+nonce+sender)
- ✅ Decryption of both incoming and own messages from backend history
- ✅ **NEW: MessengerContext architecture** - ONE socket instance, shared encryption keys, centralized state

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

**Known Issues to Fix (Priority Order):**
1. **Too many wallet verification prompts** - ✅ FIXED with MessengerContext (Jan 20)
2. **Second wallet decryption problems** - ✅ FIXED with correct recipient determination (Jan 20)
3. **No wallet connection persistence** - Closing/reopening app requires full reconnect (TODO)
4. Backend only stores messages in memory - Need SQLite/Redis for persistence (TODO)

**Next Steps:**
1. Test MessengerContext refactor thoroughly
2. Add wallet connection persistence (AsyncStorage)
3. Add backend message persistence (SQLite or Redis)
4. Polish UI/UX (chat bubbles, timestamps, scroll behavior)
5. Add .sol/.skr domain name resolution for contacts

## What We're Building

A 1:1 encrypted messenger (like Line/WeChat DMs) where:
1. Wallet address = identity (no phone number)
2. Contact list is encrypted on-chain (Arcium)
3. Messages are E2E encrypted (NaCl/TweetNaCl)
4. Message content stored off-chain (simple backend)
5. Only metadata/pointers on-chain

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React Native)                    │
│  - Wallet adapter (Phantom/Solflare)                        │
│  - E2E encryption (TweetNaCl)                               │
│  - Chat UI                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               SOLANA PROGRAM (Anchor + Arcium)              │
│                                                             │
│  Accounts:                                                  │
│  ├── UserProfile (encrypted display name, avatar)           │
│  ├── ContactList (encrypted list of contacts)               │
│  └── ConversationMeta (encrypted participant list)          │
│                                                             │
│  Instructions:                                              │
│  ├── register() - Create user profile                       │
│  ├── invite(peer) - Send contact request                    │
│  ├── accept(peer) - Accept request, create conversation     │
│  ├── reject(peer) - Reject request                          │
│  └── update_profile() - Update encrypted profile            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  MESSAGE BACKEND (Simple)                   │
│  - WebSocket server for real-time                           │
│  - Store encrypted message blobs                            │
│  - Authenticate via wallet signature                        │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Fork & Understand STEM Proto

First, clone and understand the STEM Proto (Cherry.fun) codebase:

```bash
git clone https://github.com/cherrydotfun/stem-proto.git
cd stem-proto
```

**Key files to study:**
- `programs/cherry-chat/src/lib.rs` - The Anchor program
- `app/src/composables/` - Vue composables for Stem integration
- `tests/` - Integration tests

**STEM Proto's architecture:**
```rust
// WalletDescriptor - stores peer relationships
pub struct WalletDescriptor {
    pub owner: Pubkey,
    pub peers: Vec<PeerStatus>, // Invited, Requested, Accepted, Rejected
}

// PrivateChat - stores messages between two users
pub struct PrivateChat {
    pub chat_hash: [u8; 32],  // Deterministic hash of sorted pubkeys
    pub participants: [Pubkey; 2],
    pub messages: Vec<Message>,
}

// Instructions
pub fn register() -> Result<()>           // Create WalletDescriptor
pub fn invite(invitee: Pubkey) -> Result<()>  // Send invitation
pub fn accept(hash: [u8; 32]) -> Result<()>   // Accept & create chat
pub fn reject(peer: Pubkey) -> Result<()>     // Reject invitation
pub fn sendmessage(hash: [u8; 32], content: String) -> Result<()>
```

## Phase 2: Add Arcium Encryption

This is the hackathon differentiator. We'll use Arcium to encrypt:
1. Contact lists (who you're talking to is private)
2. Conversation metadata (participants hidden)
3. User profiles (display name, avatar encrypted)

**Arcium Integration Pattern:**

```rust
// In encrypted-ixs/contact_list.rs
use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    pub struct ContactListInput {
        contacts: Vec<Pubkey>,
        new_contact: Pubkey,
    }

    #[instruction]
    pub fn add_contact(input: Enc<Shared, ContactListInput>) -> Enc<Shared, Vec<Pubkey>> {
        let data = input.to_arcis();
        let mut contacts = data.contacts;
        contacts.push(data.new_contact);
        input.owner.from_arcis(contacts)
    }
}

// In the Solana program (programs/mukon-messenger/src/lib.rs)
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

const COMP_DEF_OFFSET_ADD_CONTACT: u32 = comp_def_offset("add_contact");

#[arcium_program]
pub mod mukon_messenger {
    use super::*;

    pub fn init_add_contact_comp_def(ctx: Context<InitAddContactCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    pub fn add_contact(
        ctx: Context<AddContact>,
        computation_offset: u64,
        encrypted_contact_list: Vec<u8>,
        new_contact_pubkey: Pubkey,
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        // Queue computation with Arcium
        queue_computation(ctx.accounts, computation_offset, args, ...)?;
        Ok(())
    }
}
```

## Phase 3: Build React Native Client

Port the patterns from solchat-mobile but connect to our new program:

```typescript
// src/hooks/useMukonMessenger.ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program } from '@coral-xyz/anchor';
import { ArciumCipher, getArciumEnv } from '@arcium-hq/client';
import nacl from 'tweetnacl';

export function useMukonMessenger() {
    const { connection } = useConnection();
    const { publicKey, signMessage } = useWallet();

    // Initialize Arcium cipher for encrypted operations
    const cipher = useMemo(() => {
        if (!publicKey) return null;
        return new ArciumCipher(getArciumEnv());
    }, [publicKey]);

    // Register new user
    const register = async (displayName: string) => {
        // Encrypt display name with Arcium
        const encryptedName = cipher.encrypt([displayName]);

        // Call program
        await program.methods
            .register(encryptedName)
            .accounts({...})
            .rpc();
    };

    // Send contact invitation
    const invite = async (peerPubkey: PublicKey) => {
        await program.methods
            .invite(peerPubkey)
            .accounts({...})
            .rpc();
    };

    // Send message (off-chain, E2E encrypted)
    const sendMessage = async (conversationId: string, content: string) => {
        // Get recipient's public key
        const recipientPubkey = await getRecipientKey(conversationId);

        // Generate shared secret via ECDH
        const sharedSecret = nacl.box.before(recipientPubkey, mySecretKey);

        // Encrypt message
        const nonce = nacl.randomBytes(24);
        const encrypted = nacl.box.after(
            Buffer.from(content),
            nonce,
            sharedSecret
        );

        // Send to backend
        await api.sendMessage({
            conversationId,
            encrypted: Buffer.from(encrypted).toString('base64'),
            nonce: Buffer.from(nonce).toString('base64'),
        });
    };

    return { register, invite, sendMessage, ... };
}
```

## UI/UX Design Direction

### Design References

- **Primary inspiration:** LINE, WeChat, Telegram DM screens (clean, minimal, fast)
- **Code reference:** https://github.com/Mirokugang/solchat-mobile (for React Native + Solana patterns, UI component structure)
- **DO NOT fork solchat** - use it as reference only for UI patterns

### Design Principles

1. **Dark mode first** - Crypto users expect it
2. **Minimal chrome** - Focus on the conversation
3. **Wallet-native** - Show wallet addresses elegantly (truncated: 7xKp...3mNq)
4. **Fast** - Optimistic UI updates, don't wait for chain confirmation for messages

### Color Palette (Mukon brand)

```
Background:     #0D0D0D (near black)
Surface:        #1A1A1A (cards, inputs)
Primary:        #6366F1 (indigo - actions, links)
Secondary:      #22C55E (green - success, online status)
Text Primary:   #FFFFFF
Text Secondary: #9CA3AF (gray-400)
Accent:         #F59E0B (amber - notifications, warnings)
```

### Key Screens

#### 1. Contacts Screen (Home)
```
┌─────────────────────────────────┐
│ Mukon Messenger      [+] [⚙️]  │
├─────────────────────────────────┤
│ 🔍 Search contacts...           │
├─────────────────────────────────┤
│ ┌─────┐                         │
│ │ NFT │ vitalik.sol             │
│ │ PFP │ Last message preview... │
│ └─────┘                    2m   │
├─────────────────────────────────┤
│ ┌─────┐                         │
│ │     │ 7xKp...3mNq             │
│ │     │ Sent you an invite      │
│ └─────┘                    1h   │
└─────────────────────────────────┘
```

#### 2. Chat Screen
```
┌─────────────────────────────────┐
│ ← vitalik.sol              🔒  │
├─────────────────────────────────┤
│                                 │
│        ┌──────────────┐         │
│        │ Hey, you free │         │
│        │ to chat?      │         │
│        └──────────────┘  10:42  │
│                                 │
│  ┌──────────────┐               │
│  │ Yeah what's  │               │
│  │ up?          │               │
│  └──────────────┘  10:43        │
│                                 │
├─────────────────────────────────┤
│ [Message...]            [Send]  │
└─────────────────────────────────┘
```

#### 3. Add Contact Screen
```
┌─────────────────────────────────┐
│ ← Add Contact                   │
├─────────────────────────────────┤
│                                 │
│ Enter wallet address or .sol    │
│ ┌─────────────────────────────┐ │
│ │ 7xKp...                     │ │
│ └─────────────────────────────┘ │
│                                 │
│ Or scan QR code                 │
│       ┌───────────┐             │
│       │ [Camera]  │             │
│       └───────────┘             │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      Send Invitation        │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Assets Already Provided

- `icon.png` - App icon (use for app icon and splash)
- `logo.jpg` - Logo (use in onboarding/about screens)

### Component Library

Use **React Native Paper** or **Tamagui** for base components, then customize to match the color palette.

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

## Development Steps

### Day 1-2: Setup
```bash
# Install Arcium CLI
TARGET=x86_64_linux && curl "https://bin.arcium.com/download/arcup_${TARGET}_0.1.47" -o ~/.cargo/bin/arcup && chmod +x ~/.cargo/bin/arcup
arcup install

# Initialize project
arcium init mukon-messenger
cd mukon-messenger

# Also clone STEM Proto for reference
git clone https://github.com/cherrydotfun/stem-proto.git ../stem-proto-reference
```

### Day 3-5: Core Program
1. Port STEM Proto's account structures
2. Add Arcium encryption to ContactList
3. Write tests for invite/accept/reject flow

### Day 6-8: Client App
1. Set up React Native with Expo
2. Implement wallet connection
3. Build chat UI
4. Integrate with program

### Day 9-11: Backend + Polish
1. Simple Express/WebSocket server for messages
2. Wallet signature authentication
3. Message storage and retrieval

### Day 12-14: Demo + Submission
1. Record 3-minute demo video
2. Deploy to devnet
3. Write documentation
4. Submit to all applicable bounties

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

## Questions to Resolve During Development

1. **Message storage**: Start with simple backend, can migrate to IPFS/Arweave later
2. **Key management**: Derive encryption keys from wallet signature
3. **Arcium testnet**: Need to get cluster offset for devnet deployment
4. **Scope**: 1:1 only for MVP, groups post-hackathon

## Current Status (Jan 19, 2026)

### Development Environment

**IMPORTANT:** Using **debug build** with Metro, NOT Expo Go.
- Run with: `npx expo start --clear` (or `npm start`)
- App runs as native debug build on **PHYSICAL DEVICE** (Seeker phone via ADB)
- **NEVER use emulator** - always testing on real device
- Never suggest Expo Go commands or running through Expo Go app
- Changes require Metro restart, not full rebuild (unless native dependencies change)

**Network Configuration for Physical Device:**
- Backend runs on host machine (Mac) at `0.0.0.0:3001`
- Physical device connects via USB/ADB or WiFi
- **NOT using Android emulator `10.0.2.2` address**
- Need to use host machine's actual IP address on local network
- Host IP: `192.168.1.33` (check with `ifconfig` if changed)

### ✅ FRESH START - New Program Deployed

**NEW Program ID:** `DGAPfs1DAjt5p5J5Z5trtgCeFBWMfh2mck2ZqHbySabv`

**What Changed:**
- Deployed COMPLETELY NEW program (not an upgrade)
- All old accounts (contacts, profiles) are wiped - clean slate
- No more hacky auto-update code
- Encryption keys built-in from the start

### ✅ MVP COMPLETE (Jan 20, 2026) - Working E2E Encrypted Messenger!

**Core Features Working:**
- ✅ Solana program on devnet with encryption from day 1
- ✅ Program includes: register (with encryption key), invite, accept, reject, update_profile
- ✅ Backend running on 0.0.0.0:3001 (WebSocket + HTTP)
- ✅ React Native app with Mobile Wallet Adapter integration
- ✅ Manual transaction construction (no Anchor SDK in app)
- ✅ Contact management UI with delete button
- ✅ **E2E encrypted messaging working!**
  - NaCl box (asymmetric) encryption
  - Messages encrypted with recipient's public key + sender's secret key
  - Backend only sees encrypted blobs (true E2E encryption)
  - Both users can decrypt messages using conversation partner's encryption public key
- ✅ Message persistence: Messages load from backend on chat screen mount
- ✅ Real-time message delivery via Socket.IO
- ✅ One-time encryption key derivation in same MWA session as wallet connect
- ✅ Encryption keys persist across screens (stored in global window var)
- ✅ Duplicate message detection (matches by encrypted+nonce+sender)
- ✅ Decryption of both incoming and own messages from backend history

### Architecture Decisions
- **New program = fresh start**: Generated new keypair, no old accounts carry over
- **Encryption keys are deterministic**: Same wallet signature = same keypair forever
- **Public keys stored on-chain**: In UserProfile during registration
- **Asymmetric encryption**: NaCl box (not secretbox) for peer-to-peer messaging
- **Messages stored off-chain**: Backend holds encrypted message blobs, only metadata on-chain

### Testing Flow (BOTH WALLETS MUST RE-REGISTER)
1. **Restart metro** with cache clear: `npm start -- --reset-cache`
2. **Both wallets register** - encryption keys will be generated and stored properly
3. **Add contacts** - both users send/accept invitations
4. **Send encrypted messages** - should work cleanly now

### 🔧 Known Issues to Fix (Priority Order)

**CRITICAL - Authentication/UX:**
1. **Too many wallet verification prompts**
   - Connect wallet on login
   - Verify again to get past register page
   - Verify when opening chat screen
   - Verify to add contact
   - **Root cause:** Multiple `useMukonMessenger` instances (one per screen)
   - **Each screen:** Creates new socket, tries to authenticate separately
   - **Solution needed:** Lift `useMukonMessenger` to Context provider (ONE instance, ONE socket)

2. **No wallet connection persistence**
   - Closing/reopening app requires full wallet reconnect
   - Should persist wallet connection state in AsyncStorage
   - Need to store: publicKey, auth token, encryption signature
   - On app reopen: Check storage → auto-reconnect if available

3. **Messages not broadcasting to all connected clients**
   - Wallet A sends message → appears in Wallet A's chat
   - Wallet B doesn't receive message in real-time
   - **Likely cause:** Multiple socket instances, wrong room management, or backend broadcast issue
   - **Need to investigate:** Backend logs, socket room membership, message relay logic

**Architecture Issues:**
4. **Multiple socket connections per wallet**
   - ContactsScreen creates socket instance
   - ChatScreen creates another socket instance
   - AddContactScreen creates another socket instance
   - **Result:** 3+ sockets per wallet, duplicate authentications, wasted resources
   - **Solution:** Context provider for ONE shared socket

5. **Encryption signature stored in global window variable**
   - Hacky solution to share signature across screen instances
   - Should be in proper React Context
   - Works but not clean architecture

**Backend:**
6. **Backend only stores messages in memory**
   - Restarting backend loses all message history
   - Need to add simple persistence (SQLite or Redis)
   - Low priority for MVP but needed for demo stability

### 🎯 Next Steps (In Priority Order)

**Phase 1: Fix Critical Architecture Issues**
1. **Create MessengerContext provider**
   - Move `useMukonMessenger` logic to Context
   - ONE socket instance shared across all screens
   - Eliminates duplicate authentications
   - Reduces wallet prompts drastically

2. **Fix message broadcasting**
   - Debug why messages don't reach other wallet in real-time
   - Check backend socket room management
   - Verify io.to(conversationId).emit() is broadcasting correctly

3. **Add wallet persistence**
   - Store wallet connection in AsyncStorage
   - Auto-reconnect on app reopen
   - Store encryption signature for session restoration

**Phase 2: UI/UX Improvements** (After architecture is solid)
- Polish chat UI (bubbles, timestamps, scroll to bottom)
- Add loading states
- Better error handling and user feedback
- Display name support (currently just addresses)
- Profile pictures (avatar URLs)

**Phase 3: Hackathon Polish**
- Demo video recording
- Documentation for judges
- Deploy backend to cloud (currently localhost)
- Test on multiple physical devices simultaneously
- Submission materials

### CRITICAL UX FEATURE: Invite Unregistered Users

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

### Current Message Flow (Working as of Jan 20):

1. User types message in ChatScreen
2. `sendMessage()` encrypts with NaCl box using recipient's public key
3. Socket emits `send_message` with encrypted payload
4. Backend receives and broadcasts to conversation room
5. Recipient's socket receives `new_message` event
6. Message decrypted with correct recipient key and displayed
7. Both sender and recipient can view message history (properly encrypted/decrypted)

**Status:** ✅ E2E encrypted messaging working end-to-end!

## Git Commit Guidelines

**IMPORTANT:** Do not include Claude credits in commit messages. Keep commits professional and attribution-free.

**IMPORTANT:** Solo dev workflow - only push to remote at END of session. Commit frequently locally, but don't waste tokens pushing to remote after every commit.

## Project Assets

- `logo.jpg` - Project logo (already in repository)
- `icon.png` - App icon (already in repository)
