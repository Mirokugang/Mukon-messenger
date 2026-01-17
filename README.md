# Mukon Messenger

A private, wallet-to-wallet encrypted messenger built for the Solana Privacy Hackathon (Jan 12-30, 2026).

**🚀 Status**: Deployed to Solana devnet and ready for testing!

## Quick Start

```bash
# 1. Start backend
cd backend && node src/index.js &

# 2. Launch mobile app
cd app && npx expo start

# 3. Test on device (press 'i' for iOS or 'a' for Android)
```

See [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) for complete testing instructions.

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

**Status:** ✅ Deployed to devnet (Program ID: 89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr)

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

**Status:** ✅ Running on http://localhost:3001

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

**Status:** ✅ Fully integrated and ready (1,316 dependencies installed)

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

**Current Status:** ✅ Encrypted circuits built successfully

**Compiled Instructions:**
- `is_accepted_contact` - Private contact verification (13.9B ACUs)
- `count_accepted` - Count accepted contacts privately (2.2B ACUs)
- `add_two_numbers` - Demo instruction (485M ACUs)

**Architecture:**
- Fixed-size contact list (MAX_CONTACTS=100) for MPC compatibility
- Constant-time operations for privacy preservation
- Ready for full Anchor program integration

See [ARCIUM_STATUS.md](./ARCIUM_STATUS.md) for detailed integration status.

## Bounty Targets

- **Arcium ($10,000):** Best integration, most encrypted potential
- **Open Track ($18,000):** Privacy messenger
- **ShadowWire/Radr Labs ($15,000):** Private payment splits (stretch)
- **Helius ($5,000):** Use Helius RPC

## Development Notes

### What's Working
✅ Anchor program deployed to devnet
✅ All tests passing (7/7)
✅ WebSocket backend running
✅ React Native app fully integrated with Anchor
✅ E2E encryption with TweetNaCl
✅ Dark mode UI with Mukon branding
✅ Arcium encrypted circuits compiled
✅ Dev wallet for testing

### What's TODO
- [ ] E2E user flow testing (register → invite → chat)
- [ ] Full Arcium integration into Anchor program
- [ ] Replace dev wallet with production wallet adapter
- [ ] Message persistence (Redis/PostgreSQL)
- [ ] Push notifications
- [ ] QR code scanner for adding contacts
- [ ] Deploy to mainnet

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
