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

## Current Status (as of 2026-01-17)

**What's Deployed:**
- Solana program deployed to devnet: `89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr`
- Program includes Arcium encryption for contact lists (on-chain encryption working)
- Backend WebSocket server running on localhost:3001

**What's Working:**
- React Native app structure complete
- Wallet connection via Solana Mobile Wallet Adapter (MWA) working
- Base64 address decoding from MWA working
- Wallet connects successfully: `3uBhqxZT3oCY9F9127YvU3XeoZC4ouB2yCzf3HdgXzLr`
- All polyfills in place (Buffer, structuredClone, TextEncoder/TextDecoder)

**What's NOT Working:**
- Anchor SDK still trying to initialize despite removing imports from useMukonMessenger.ts
- App shows initialization errors related to Anchor/React Native compatibility
- Manual transaction construction implemented but not tested yet

**Implementation Details:**
- Created `/app/src/utils/transactions.ts` with manual instruction builders:
  - `createRegisterInstruction()` - Manual transaction for registration
  - `createInviteInstruction()` - Manual transaction for invitations
  - `createAcceptInstruction()` - Manual transaction for accepting contacts
  - `createRejectInstruction()` - Manual transaction for rejecting contacts
  - `buildAndSendTransaction()` - Builds VersionedTransaction and sends via connection
- Updated `useMukonMessenger.ts` to use manual transactions instead of Anchor Program
- Removed Anchor Program initialization code
- BUT: Anchor package still in package.json and being imported somewhere

**Next Steps:**
1. Find and remove ALL remaining Anchor imports/initialization
2. Verify @coral-xyz/anchor is completely removed from the build
3. Test registration transaction on-chain
4. Test invite/accept flow
5. Implement account deserialization for loadProfile/loadContacts (optional)

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

## Git Commit Guidelines

**IMPORTANT:** Do not include Claude credits in commit messages. Keep commits professional and attribution-free.

## Project Assets

- `logo.jpg` - Project logo (already in repository)
- `icon.png` - App icon (already in repository)
