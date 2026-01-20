# Mukon Messenger

A private, wallet-to-wallet encrypted messenger built for the Solana Privacy Hackathon (Jan 12-30, 2026).

**🚀 Status**: MVP Complete! E2E encrypted messaging working. Arcium integration in progress.

**Latest Update (Jan 20, 2026):**
- ✅ Working E2E encrypted messenger with MessengerContext architecture
- ✅ ONE socket instance, shared encryption keys, centralized state
- ✅ Fixed critical decryption bug (both wallets can decrypt messages)
- ⏳ Arcium v0.6.3 integration ready to implement (circuits built, waiting for program integration)

## Quick Start

**Prerequisites:** You need a physical Android device with ADB or Wi-Fi debugging enabled.

```bash
# 1. Start backend (on host machine)
cd backend && node src/index.js

# 2. Start Metro bundler (in new terminal)
cd app && npm start

# 3. Install on device
# The app is a debug build, not Expo Go!
# Use ADB to install or rebuild with: npx expo run:android
```

**Important:** This is a native debug build, NOT Expo Go. Backend runs on host IP `10.206.4.164:3001` for physical device connection.

## Overview

Mukon Messenger is a privacy-first messaging app where:
- **Wallet address = identity** (no phone number required)
- **Contact lists encrypted on-chain** (designed for Arcium integration)
- **Messages E2E encrypted** (TweetNaCl)
- **Message content stored off-chain** (WebSocket backend)
- **Only metadata/pointers on-chain**

## Project Structure

```
mukon-messenger/
├── programs/mukon-messenger/    # Anchor Solana program
│   └── src/lib.rs              # Core program logic
├── tests/                       # Anchor program tests
├── app/                         # React Native mobile app
│   ├── src/
│   │   ├── screens/            # UI screens
│   │   ├── hooks/              # React hooks for Solana integration
│   │   └── utils/              # Encryption utilities
│   └── package.json
├── backend/                     # WebSocket message relay
│   └── src/index.js
├── ICON.png                     # App icon
├── Logo.jpg                     # App logo
└── Anchor.toml
```

## Components

### 1. Solana Program (Anchor)

**Location:** `programs/mukon-messenger/src/lib.rs`

**Accounts:**
- `UserProfile` - Stores display name and avatar URL
- `WalletDescriptor` - Stores peer relationships (invited, requested, accepted, rejected)
- `Conversation` - Stores conversation metadata (participants, created_at)

**Instructions:**
- `register(display_name)` - Create user profile and wallet descriptor
- `update_profile(display_name?, avatar_url?)` - Update user profile
- `invite(chat_hash)` - Send contact invitation
- `accept()` - Accept invitation
- `reject()` - Reject invitation

**Status:** ✅ Deployed to devnet (Program ID: `DGAPfs1DAjt5p5J5Z5trtgCeFBWMfh2mck2ZqHbySabv`)

**Latest Changes (Jan 20):**
- New program deployed with encryption keys from day 1
- All old accounts wiped (fresh start with proper architecture)

### 2. Message Backend (Express + Socket.IO)

**Location:** `backend/src/index.js`

**Features:**
- WebSocket real-time messaging
- Wallet signature authentication
- In-memory message storage (replace with Redis/DB for production)
- REST API for message history

**Endpoints:**
- `GET /health` - Health check
- `POST /messages` - Send message (with signature verification)
- `GET /messages/:conversationId` - Get message history

**WebSocket Events:**
- `authenticate` - Authenticate with wallet signature
- `join_conversation` - Join a conversation room
- `send_message` - Send encrypted message
- `new_message` - Receive new messages

**Status:** ✅ Running on http://10.206.4.164:3001 (host IP for physical device testing)

### 3. React Native App (Expo)

**Location:** `app/`

**Screens:**
- `ContactsScreen` - List of contacts and conversations
- `ChatScreen` - 1:1 encrypted chat interface
- `AddContactScreen` - Send contact invitations
- `ProfileScreen` - User profile and settings

**Key Files:**
- `src/contexts/MessengerContext.tsx` - **NEW!** Centralized messenger logic (socket, encryption, state)
- `src/contexts/WalletContext.tsx` - Wallet connection via MWA
- `src/utils/transactions.ts` - Manual transaction builders (no Anchor SDK in app)
- `src/utils/encryption.ts` - E2E encryption utilities (NaCl box)
- `src/theme.ts` - Dark mode Mukon brand colors

**Design:**
- Dark mode first (#0D0D0D background)
- Indigo primary color (#6366F1)
- Green secondary (#22C55E)
- Clean, minimal UI inspired by LINE/WeChat

**Status:** ✅ Fully functional with MessengerContext architecture (1,316 dependencies installed)

**Architecture Improvements (Jan 20):**
- ONE socket instance for entire app (was: one per screen)
- ONE authentication flow (was: constant wallet prompts)
- Shared encryption keys across all components
- Centralized message state with deduplication
- Fixed critical decryption bug (correct recipient determination)

## Running the Project

### Prerequisites

- Rust 1.88+
- Solana CLI
- Anchor CLI 0.32.1
- Node.js 18+
- (Optional) Expo CLI for mobile app

### 1. Build and Test Solana Program

```bash
# Build the program
anchor build

# Run tests
anchor test

# Deploy to devnet (optional)
anchor deploy --provider.cluster devnet
```

**Expected output:** All 7 tests passing

### 2. Run Message Backend

```bash
cd backend
npm install
npm start
```

**Expected output:**
```
Mukon Messenger backend running on port 3001
WebSocket endpoint: ws://localhost:3001
HTTP endpoint: http://localhost:3001
```

### 3. Run Mobile App (Development)

```bash
cd app
npm install
npx expo start
```

**Note:** The app is currently a UI shell. To fully integrate:
1. Install dependencies: `npm install`
2. Update `useMukonMessenger.ts` to connect to deployed program
3. Add wallet adapter (@solana-mobile/wallet-adapter-mobile)
4. Test on device or simulator

## Testing the Flow

### Manual Test Flow

1. **Start local validator:**
   ```bash
   solana-test-validator
   ```

2. **Deploy program:**
   ```bash
   anchor deploy --provider.cluster localnet
   ```

3. **Run tests:**
   ```bash
   anchor test --skip-local-validator
   ```

4. **Start backend:**
   ```bash
   cd backend && npm start
   ```

5. **Test backend:**
   ```bash
   curl http://localhost:3001/health
   ```

## Encryption Architecture

### On-Chain (Designed for Arcium)
- Contact lists encrypted with Arcium MPC
- Social graph privacy preserved
- Only you can see who you're talking to

### Off-Chain (TweetNaCl)
- Messages encrypted end-to-end
- Shared secret via ECDH (Elliptic Curve Diffie-Hellman)
- Encryption keys derived from wallet signatures

```typescript
// Derive encryption keypair
const message = "Sign to derive encryption keys for Mukon Messenger";
const signature = await wallet.signMessage(Buffer.from(message));
const keypair = nacl.box.keyPair.fromSecretKey(signature.slice(0, 32));

// Encrypt message
const encrypted = nacl.box(
  messageBytes,
  nonce,
  recipientPublicKey,
  senderSecretKey
);
```

## Arcium Integration Status

**Current Status (Jan 20, 2026):** ⚠️ Circuits built, program integration in progress

**What's Ready:**
- ✅ Encrypted circuits compiled (3 instructions)
  - `is_accepted_contact` - Private contact verification (13.9B ACUs)
  - `count_accepted` - Count accepted contacts privately (2.2B ACUs)
  - `add_two_numbers` - Demo instruction (485M ACUs)
- ✅ Program has `#[arcium_program]` macro
- ✅ Dependencies compatible with v0.6.3

**What's Next:**
- [ ] Upgrade to Arcium v0.6.3 (officially released Jan 20!)
- [ ] Integrate comp_def initialization into program
- [ ] Add queue_computation calls for encrypted operations
- [ ] Deploy computation definitions to devnet
- [ ] Test private contact verification E2E

**Why This Matters:**
Without Arcium, contact lists are visible on-chain. With Arcium, you can prove "Alice is my contact" without revealing your other contacts. Maximum privacy! 🔒

**Timeline:** Integrating this week for hackathon submission (due Jan 30).

See [ARCIUM_STATUS.md](./ARCIUM_STATUS.md) for detailed migration guide and integration steps.

## Bounty Targets

- **Arcium ($10,000):** Best integration, most encrypted potential
- **Open Track ($18,000):** Privacy messenger
- **ShadowWire/Radr Labs ($15,000):** Private payment splits (stretch)
- **Helius ($5,000):** Use Helius RPC

## Development Notes

### What's Working (Jan 20, 2026)
✅ E2E encrypted messaging (both wallets can decrypt)
✅ MessengerContext architecture (ONE socket, shared state)
✅ Solana program deployed to devnet
✅ Mobile Wallet Adapter integration
✅ Manual transaction construction (React Native compatible)
✅ Contact invitation/accept/reject flow
✅ Real-time message delivery via Socket.IO
✅ Message persistence (loads from backend on mount)
✅ Duplicate message detection
✅ NaCl box asymmetric encryption
✅ Dark mode UI with Mukon branding
✅ Arcium encrypted circuits compiled

### Critical Issues Fixed (Jan 20)
✅ Multiple socket instances → ONE shared socket
✅ Constant wallet prompts → ONE authentication
✅ Second wallet decryption failure → Fixed recipient determination
✅ Duplicate messages → Proper deduplication by (encrypted+nonce+sender)

### What's TODO
**High Priority (This Week):**
- [ ] Integrate Arcium v0.6.3 into program
- [ ] Deploy computation definitions to devnet
- [ ] Test encrypted contact verification E2E

**Medium Priority:**
- [ ] Add wallet connection persistence (AsyncStorage)
- [ ] Backend message persistence (SQLite/Redis)
- [ ] Polish UI/UX (chat bubbles, timestamps, scroll behavior)
- [ ] Add .sol/.skr domain name resolution

**Nice to Have:**
- [ ] Push notifications
- [ ] QR code scanner for adding contacts
- [ ] Group chats
- [ ] Deploy to mainnet (after hackathon)

## Tech Stack

- **Blockchain:** Solana (Anchor 0.32.1)
- **MPC Encryption:** Arcium v0.6.2 (circuits compiled)
- **E2E Encryption:** TweetNaCl
- **Backend:** Express.js + Socket.IO
- **Frontend:** React Native + Expo 51
- **UI Library:** React Native Paper
- **Navigation:** React Navigation
- **State Management:** React Context API

## References

- Arcium Docs: https://docs.arcium.com/developers
- Arcium Examples: https://github.com/arcium-hq/examples
- Anchor Framework: https://www.anchor-lang.com
- Solana Docs: https://docs.solana.com
- Solana Privacy Hack: https://solana.com/privacyhack
- TweetNaCl.js: https://github.com/dchest/tweetnacl-js

## License

ISC

---

Built for the Solana Privacy Hackathon 2026
