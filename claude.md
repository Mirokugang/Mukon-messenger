# Mukon Messenger - Claude Code Development Brief

## Project Overview

Private, wallet-to-wallet encrypted messenger for Solana Privacy Hackathon (Jan 12-30, 2026).

**Goal:** Win multiple bounties ($48K+ potential) with privacy-first messenger + Arcium encrypted on-chain state.

**Key Features:**
- E2E encrypted DMs (NaCl box)
- Group chat with symmetric encryption (NaCl secretbox)
- Encrypted contact lists + group membership (Arcium MPC)
- Emoji avatars, reactions, replies
- .sol/.skr domain resolution
- Token-gated groups

---

## Development Guidelines

**IMPORTANT - Dev Servers & Builds:**
- NEVER run dev servers (npx expo start, npm run dev) - user runs these
- NEVER run builds (npx expo run:android) - user builds and installs via ADB
- User needs device logs directly (not visible to Claude)

**Backend URL:**
- Configured in `app/src/config.ts` - change IP based on network location
- Dev: Update to current host IP (check with `ifconfig`)
- Prod: Deploy to Fly.io (https://mukon-backend.fly.dev)

---

## ⚠️ DEVNET ONLY: Program Redeployment Strategy

**For hackathon development**, we use `close_profile` to allow re-registration after breaking changes:

```typescript
await messenger.closeProfile(); // Close old account
await messenger.register('Name', '🦅'); // Re-register with new schema
```

**WHY:** Account structures change during dev (e.g., added `avatar_type` field). Solana accounts can't be re-initialized.

### 🚨 BEFORE MAINNET - Proper Upgrade Strategy Required

**Current Problem:** No version field, no migration logic, breaking changes force re-registration.

**Required for Production:**
1. Add `version: u8` to all account structs
2. Multi-version client deserializers
3. Lazy migration (auto-upgrade on write)
4. Test migration path on devnet
5. Remove/restrict `close_profile`

**References:**
- https://book.anchor-lang.com/anchor_references/account_types.html
- https://github.com/metaplex-foundation/metaplex-program-library

---

## Program Deployment Workflow

### 1. Build and Deploy
```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Extract Discriminators
```bash
node scripts/update-discriminators.js
```

This script:
- Reads IDL from `target/idl/mukon_messenger.json`
- Extracts 8-byte instruction discriminators
- Auto-updates `app/src/utils/transactions.ts`

**Manual Alternative:**
```bash
anchor idl parse -f target/idl/mukon_messenger.json
# Copy discriminators to transactions.ts DISCRIMINATORS object
```

### 3. Rebuild Client
```bash
cd app
npm run build  # or npm run build:clean if needed
```

### 4. Test on Device
```bash
adb install -r app-debug.apk
```

**What are discriminators?** 8-byte instruction identifiers (first 8 bytes of `sha256("global:instruction_name")`). Must match between client and program.

---

## Current Status (as of 2026-01-31)

**Deployed:**
- Solana program: `GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj` (devnet)
- Backend: Running on configurable host IP (see `app/src/config.ts`)

**Working Features:**

**DMs:**
- ✅ Wallet connection (Solana Mobile Wallet Adapter)
- ✅ User registration with encryption public key
- ✅ Contact invitations (invite before target registers)
- ✅ E2E encrypted messaging (NaCl box)
- ✅ Contact blocking/unblocking
- ✅ Symmetric contact deletion
- ✅ Message deletion (delete for self or everyone)

**Messaging:**
- ✅ Message reactions (❤️ 🔥 💯 😂 👍 👎)
- ✅ Reply to messages
- ✅ Copy message to clipboard
- ✅ Real-time delivery (Socket.IO)
- ✅ Message persistence (backend in-memory)
- ✅ Duplicate detection

**Profile & Contacts:**
- ✅ Emoji avatars (200+ curated emojis)
- ✅ Avatar display in chat, header, drawer, contacts
- ✅ DM always-show avatar with first-letter fallback
- ✅ Always-editable username
- ✅ .sol/.skr domain resolution (SNS)
- ✅ Custom contact names (local AsyncStorage)
- ✅ Name priority: Custom > Domain > On-chain > Pubkey

**Groups:**
- ✅ Create groups (up to 30 members)
- ✅ Group invitations (any member can invite)
- ✅ Token gating (SPL token balance verification)
- ✅ Group management (admin kicks, members leave)
- ✅ Group encryption (NaCl secretbox)
- ✅ Unified conversations (DMs + Groups)
- ✅ Group key distribution (request if offline)
- ✅ Group rename (admin only, on-chain via updateGroup)
- ✅ Group emoji avatars (local AsyncStorage, shown in info/header/list)

**UI/UX:**
- ✅ Telegram-style drawer navigation
- ✅ Settings screen
- ✅ Three-tier build system (build / clean / prebuild)
- ✅ SVG crypto wallpaper (wallet, key, shield, chain, coin, hex, Solana swoosh)
- ✅ react-native-svg installed (requires native rebuild via build:prebuild)

**Known Issues:**
1. **Wallet persistence** - Closing app requires full reconnect
2. **Backend persistence** - Currently in-memory, needs database (Fly.io Postgres)
3. **Domain resolution** - Needs mainnet testing with real .sol/.skr domains
4. **Group key rotation** - Only rotates on kick (security debt)
5. **Group creator visibility** - loadGroups() only queries GroupInvite, doesn't show groups you created
6. **Native rebuild required** - react-native-svg requires `build:prebuild` for wallpaper to render

**Next Steps:**
1. 🔄 Test all features E2E (rebuild needed - react-native-svg requires native build)
2. 🔄 UI polish pass (loading states, error handling, placeholder screens for future features)
3. 🔄 **ARCIUM INTEGRATION** - Encrypt contact lists + groups on-chain ($10k bounty) - **TOP PRIORITY**
4. 🔜 Deploy backend to Fly.io (WebSocket + Postgres persistence)
5. 🔜 Demo video prep - "coming soon" placeholder screens for unimplemented features
6. 🔜 Add wallet connection persistence
7. 🔜 Mainnet deployment (program + backend)

**Detailed fix history:** See CHANGELOG.md

---

## What We're Building

A 1:1 encrypted messenger where:
1. Wallet address = identity (no phone number)
2. Contact list encrypted on-chain (Arcium)
3. Messages E2E encrypted (NaCl/TweetNaCl)
4. Message content stored off-chain
5. Only metadata/pointers on-chain

---

## Technical Architecture

### Current (MVP)
```
CLIENT (React Native)
  ├── Solana Mobile Wallet Adapter (MWA)
  ├── E2E encryption (NaCl box - asymmetric for DMs)
  ├── Group encryption (NaCl secretbox - symmetric)
  ├── MessengerContext (centralized socket/state)
  └── Chat UI

SOLANA PROGRAM (Anchor + Arcium)
  Program ID: GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj

  Accounts:
  ├── UserProfile (name, avatar, encryption pubkey)
  ├── WalletDescriptor (peer relationships)
  ├── Group (members, token gate, encryption pubkey)
  └── GroupInvite (pending invitations)

  Instructions:
  ├── register() - Create profile + encryption key
  ├── invite/accept/reject() - Contact management
  ├── block/unblock() - Harassment prevention
  ├── create_group() - Create group
  ├── invite_to_group() - Any member can invite
  ├── accept_group_invite() - Join group (checks token gate)
  ├── leave_group/kick_member() - Group management
  └── update_profile/update_group/close_profile()

MESSAGE BACKEND (WebSocket)
  ├── Socket.IO for real-time delivery
  ├── Encrypted message blobs
  ├── Wallet signature authentication
  ├── Message deletion support
  └── Group key distribution
```

### Target (With Full Arcium)
```
LAYER 3: CLIENT (E2E)
  ├── NaCl box encryption (message content)
  ├── Arcium MPC queries (encrypted contact list access)
  └── Zero-knowledge relationship proofs

LAYER 2: OFF-CHAIN (Relay)
  ├── Encrypted message blob (can't read)
  ├── Destination: [ENCRYPTED or anonymous ID]
  └── Timestamp (ordering only)
  → Relay can't see sender/recipient or correlate conversations

LAYER 1: ON-CHAIN (Arcium MPC)
  ├── Contact lists (encrypted)
  ├── Conversation existence (encrypted)
  ├── Message pointers (encrypted)
  ├── User profiles (encrypted)
  └── Social graph (encrypted)
  → Even developers can't see who talks to whom
  → MPC proves relationships without revealing data
```

**Privacy Goals:**
- 🔒 Message content encrypted (NaCl E2E)
- 🔒 Contact lists encrypted (Arcium MPC)
- 🔒 Social graph encrypted (Arcium MPC)
- 🔒 Conversation metadata encrypted (Arcium MPC)
- 🔒 Message routing anonymized
- 🔒 Relay nodes can't correlate conversations
- 🔒 On-chain observers can't map social networks

---

## Directory Structure

```
mukon-messenger/
├── programs/mukon-messenger/
│   ├── src/lib.rs          # Anchor program
│   └── Cargo.toml
├── app/                     # React Native client
│   ├── src/
│   │   ├── contexts/
│   │   │   ├── MessengerContext.tsx  # Centralized state/socket
│   │   │   └── WalletContext.tsx
│   │   ├── screens/
│   │   ├── components/
│   │   ├── utils/
│   │   │   ├── transactions.ts  # Manual tx builders
│   │   │   ├── encryption.ts
│   │   │   └── domains.ts
│   │   └── config.ts        # Backend URL config
│   └── package.json
├── backend/                 # WebSocket relay
│   └── src/index.js
├── scripts/
│   └── update-discriminators.js
├── CLAUDE.md                # This file
└── CHANGELOG.md             # Detailed fix history
```

---

## 🚀 GROUP CHAT ARCHITECTURE

### Core Settings
- **Group ID:** Pure random 32 bytes (maximum privacy)
- **Max Members:** 30 for MVP
- **Admin Model:** Creator = only admin (MVP)
- **Visibility:** Members see each other (encrypted from outsiders via Arcium)
- **Key Rotation:** Only on kicks (security debt for MVP)
- **Invitations:** Any member can invite (not just admin)

### Token Gating
- Simple fungible token balance check on accept
- User passes token account, program verifies `amount >= min_balance`
- NFT gating is post-MVP

### Solana Program Instructions

```
DM Instructions (9):
├── register(display_name, avatar_data, encryption_pubkey)
├── update_profile(display_name, avatar_data, encryption_pubkey)
├── invite(peer)
├── accept(peer)
├── reject(peer)
├── block(peer)
├── unblock(peer)
└── close_profile()

Group Instructions (8):
├── create_group(group_id, name, encryption_pubkey, token_gate?)
├── update_group(group_id, name?, token_gate?)
├── invite_to_group(group_id, invitee) — any member can invite
├── accept_group_invite(group_id) — checks token gate
├── reject_group_invite(group_id)
├── leave_group(group_id)
├── kick_member(group_id, member) — creator only
└── close_group(group_id) — creator only
```

### Account Structures

```rust
#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub display_name: String,        // Max 64 chars
    pub avatar_type: AvatarType,     // Emoji or NFT
    pub avatar_data: String,         // Emoji char or NFT mint
    pub encryption_public_key: [u8; 32],
}

#[account]
pub struct WalletDescriptor {
    pub owner: Pubkey,
    pub peers: Vec<PeerRelation>,    // Contact list
}

#[account]
pub struct Group {
    pub group_id: [u8; 32],
    pub creator: Pubkey,
    pub name: String,
    pub created_at: i64,
    pub members: Vec<Pubkey>,        // Max 30
    pub encryption_pubkey: [u8; 32],
    pub token_gate: Option<TokenGate>,
}

#[account]
pub struct GroupInvite {
    pub group_id: [u8; 32],
    pub inviter: Pubkey,
    pub invitee: Pubkey,
    pub status: GroupInviteStatus,
    pub created_at: i64,
}
```

### Group Encryption Model

Messages NOT stored on-chain. Shared secret encryption:

1. **Create Group:** Creator generates random 32-byte `group_secret`, stores locally
2. **Invite Member:** Admin encrypts `group_secret` with invitee's pubkey (NaCl box), sends via Socket.IO
3. **Send Message:** Sender encrypts with `group_secret` (NaCl secretbox), backend broadcasts
4. **Receive Message:** All members decrypt with same `group_secret`
5. **Kick Member (Future):** Rotate `group_secret`, redistribute to remaining members

### Backend Socket.IO Events

```typescript
// Client → Server
'join_group_room': { groupId }
'leave_group_room': { groupId }
'group_message': { groupId, encryptedContent, nonce }
'group_key_share': { groupId, recipientPubkey, encryptedKey, nonce }
'request_group_key': { groupId }

// Server → Client
'group_message': { groupId, senderPubkey, encryptedContent, nonce, timestamp }
'group_member_joined': { groupId, memberPubkey }
'group_member_left': { groupId, memberPubkey }
'group_member_kicked': { groupId, memberPubkey }
'group_key_shared': { groupId, senderPubkey, encryptedKey, nonce }
```

### ⚠️ Arcium Encryption (NON-NEGOTIABLE)

Arcium encryption ships with hackathon submission. Encrypts:
- DMs: `WalletDescriptor.peers[]`
- Groups: `Group.members[]`
- Invites: `GroupInvite.invitee`

Same circuits work for both (is_accepted_contact → is_group_member).

---

## CRITICAL UX FEATURE: Invite Unregistered Users

The `invite` instruction uses `init_if_needed` on `invitee_descriptor`:
- If invitee hasn't registered: Creates WalletDescriptor with pending invitation
- If invitee has registered: Adds to existing WalletDescriptor
- When invitee registers, they see pending invitations

**Implementation:** `programs/mukon-messenger/src/lib.rs` lines 302-309

---

## Testing Guidelines

### Manual E2E Testing Flow

**Prerequisites:**
- Both wallets registered on program GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj
- Backend running (check IP in `app/src/config.ts`)
- Metro: `npm start -- --reset-cache`

**Test Flow (Two Devices):**
1. Device 1: Connect wallet → register → copy address
2. Device 2: Connect wallet → register → copy address
3. Device 1: Add contact (Device 2 address) → send invitation
4. Device 2: See invitation → accept
5. Exchange messages (both decrypt correctly)

**Success Criteria:**
- Both wallets send/receive messages
- Messages decrypt correctly
- No duplicate messages
- No constant wallet prompts
- Messages persist after leaving/re-entering chat

### Performance Expectations
- Registration: ~2-3s (on-chain tx)
- Invitation/Accept: ~2-3s (on-chain tx)
- Message send: <100ms (WebSocket)
- Message receive: Real-time (<50ms)

---

## Bounty Targets

### Primary: Arcium ($10,000)
- Best integration: $3k
- Most <encrypted> potential: $1k x 2

### Secondary: Open Track ($18,000)
- Privacy messenger (Light Protocol)

### Stretch: ShadowWire/Radr Labs ($15,000)
- Private payment splits in chat

### Easy: Helius ($5,000)
- Use their RPC

---

## Hackathon Submission Checklist

**CRITICAL:**
- [ ] **Remove CLAUDE.md** from submission branch (or .gitignore it)
- [ ] Keep it locally for post-hackathon development

**Architecture Decisions:**
- ✅ STEM Proto: Won't mention in public docs (code is substantially original)
- ✅ Contact Management: Delete + Block implemented

**Production Launch:**
- 🚀 **GOING TO MAINNET** around hackathon submission
- 🎯 **Backend:** Deploy to Fly.io (WebSocket support, edge deployment, low latency)
- 📝 See PRODUCTION_DEPLOY.md

**Deployment Timeline:**
1. ✅ Week 1 (Jan 20-26): Core messenger MVP (DMs, groups, encryption)
2. 🔄 Week 2 (Jan 27-30): Arcium integration, UI polish, deploy to Fly.io/mainnet, submit hackathon
3. 🔜 Week 3+ (Feb): Add persistence, monitoring, launch on Solana Mobile dApp Store

**Before mainnet:**
- [ ] Deploy backend to Fly.io
- [ ] Make backend URL configurable (dev vs prod)
- [ ] Deploy program to mainnet-beta
- [ ] Add message persistence (Fly.io Postgres)
- [ ] Add monitoring (Sentry, UptimeRobot)
- [ ] Test extensively on mainnet

---

## Git Commit Guidelines

**IMPORTANT:**
- Do not include Claude credits in commits
- Solo dev workflow: only push to remote at END of session
- Commit frequently locally, but don't waste tokens pushing after every commit

---

## Project Assets

- `logo.jpg` - Project logo
- `icon.png` - App icon
