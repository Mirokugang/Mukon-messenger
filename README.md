# Mukon Messenger

A private, wallet-to-wallet encrypted messenger built for the Solana Privacy Hackathon (Jan 12-30, 2026).

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

**Status:** ✅ Built and tested (7/7 tests passing)

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

**Status:** ✅ Implemented and tested

### 3. React Native App (Expo)

**Location:** `app/`

**Screens:**
- `ContactsScreen` - List of contacts and conversations
- `ChatScreen` - 1:1 encrypted chat interface
- `AddContactScreen` - Send contact invitations
- `ProfileScreen` - User profile and settings

**Key Files:**
- `src/hooks/useMukonMessenger.ts` - Main hook for Solana program interaction
- `src/utils/encryption.ts` - E2E encryption utilities (TweetNaCl)
- `src/theme.ts` - Dark mode Mukon brand colors

**Design:**
- Dark mode first (#0D0D0D background)
- Indigo primary color (#6366F1)
- Green secondary (#22C55E)
- Clean, minimal UI inspired by LINE/WeChat

**Status:** ✅ Structure complete (requires dependencies installation)

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

**Current Status:** Core program built without Arcium due to macOS compatibility issues with Docker images.

**Designed for Arcium:**
- `ContactList` account structure ready for encryption
- `encrypted-ixs/` directory prepared for confidential instructions
- Architecture supports adding Arcium encryption without major refactoring

**To add Arcium:**
1. Install Arcium CLI on Linux environment
2. Create `encrypted-ixs/contact_operations.rs`
3. Update program to use `queue_computation()`
4. See `CLAUDE.md` for detailed integration patterns

## Bounty Targets

- **Arcium ($10,000):** Best integration, most encrypted potential
- **Open Track ($18,000):** Privacy messenger
- **ShadowWire/Radr Labs ($15,000):** Private payment splits (stretch)
- **Helius ($5,000):** Use Helius RPC

## Development Notes

### What's Working
✅ Anchor program (register, invite, accept, reject)
✅ All tests passing (7/7)
✅ WebSocket backend with wallet authentication
✅ React Native app structure
✅ E2E encryption utilities
✅ Dark mode UI components

### What's TODO
- [ ] Complete wallet adapter integration in app
- [ ] Connect app to deployed program
- [ ] Add Arcium encryption (requires Linux)
- [ ] Implement message persistence (SQLite/Redis)
- [ ] Add push notifications
- [ ] QR code scanner for adding contacts
- [ ] Deploy to devnet/mainnet

## Tech Stack

- **Blockchain:** Solana (Anchor 0.32.1)
- **Encryption (Planned):** Arcium MPC
- **E2E Encryption:** TweetNaCl
- **Backend:** Express.js + Socket.IO
- **Frontend:** React Native + Expo
- **UI Library:** React Native Paper
- **Navigation:** React Navigation

## References

- STEM Proto (cherry-chat): https://github.com/cherrydotfun/stem-proto
- Arcium Docs: https://docs.arcium.com/developers
- Arcium Examples: https://github.com/arcium-hq/examples
- Solana Privacy Hack: https://solana.com/privacyhack

## License

ISC

---

Built with Claude Code for the Solana Privacy Hackathon 2026
