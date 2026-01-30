# Mukon Messenger - Development Changelog

## Jan 28, 2026 - Critical Fixes Session 2

### Fixed: Profile Update Discriminator Typo
- **Problem:** `transactions.ts` used `DISCRIMINATORS.updateProfile` (camelCase) but key is `update_profile`
- **Error:** "Cannot read property 'length' of undefined"
- **Fix:** Changed to `DISCRIMINATORS.update_profile` + updated ProfileScreen args
- **Files:** `app/src/utils/transactions.ts`, `app/src/screens/ProfileScreen.tsx`

### Fixed: Add Members Button Missing
- **Problem:** `wallet` not exposed in MessengerContext, so `isAdmin` check always false
- **Fix:** Added `wallet: WalletContextType | null` to interface and value object
- **Files:** `app/src/contexts/MessengerContext.tsx`

### Fixed: DM Decryption Failing
- **Problem:** UserProfile deserialization MISSING `avatar_type` byte
- **Root Cause:** All fields after display_name read at wrong offset, encryption keys were garbage
- **Fix:** Added `avatar_type` byte read in loadContacts() and loadProfile()
- **Files:** `app/src/contexts/MessengerContext.tsx` (lines 847, 909)
- **Impact:** CRITICAL - DM decryption now works correctly

### Fixed: Group Key Distribution Missing
- **Problem:** Group keys only shared via socket when invitee online, no persistence
- **Fix (Backend):** Added `pendingKeyShares` storage, `request_group_key` handler
- **Fix (Client):** Call `socket.emit('request_group_key')` after accepting invite
- **Files:** `backend/src/index.js`, `app/src/contexts/MessengerContext.tsx`

### Group Invite Policy Change
- **OLD:** Only admin can invite members
- **NEW:** ANY member can invite, only admin can kick
- **Rationale:** More organic growth, matches WhatsApp/Telegram UX
- **Files:** `programs/mukon-messenger/src/lib.rs`, `app/src/screens/GroupInfoScreen.tsx`

---

## Jan 28, 2026 - Critical Fixes Session 1

### Fixed: ConstraintSpace Error During Re-registration
- **Problem:** close_profile only closed UserProfile, left 77-byte WalletDescriptor
- **Result:** Re-registration failed with "ConstraintSpace. Left: 3344, Right: 77"
- **Fix:** close_profile now closes BOTH accounts and returns full rent
- **Impact:** Clean re-registration flow for devnet development

### Fixed: NotRequested Error When Accepting Invitations
- **Problem:** register instruction unconditionally set `wallet_descriptor.peers = vec![]`
- **Result:** Invitations sent before target registered were erased
- **Fix:** register now checks if WalletDescriptor exists and preserves peers
- **Impact:** Invite-before-register flow now works correctly

---

## Jan 24, 2026 - Avatar Display & Reaction Toggle

### Fixed: Avatars Not Displaying
- **Problem:** JavaScript `.length` treats multi-byte emojis incorrectly ("🦅".length === 2)
- **Solution:** Replaced all checks with `Array.from(avatar).length === 1`
- **Files:** ChatScreen, CustomDrawer, ContactsScreen

### Fixed: Reaction System Refinement
- **Problem:** Users could react multiple times, no toggle to remove, reactions obscured text
- **Solution:**
  - Backend: Toggle logic (click same emoji to remove)
  - Frontend: Moved reactions below bubble, separated touch handlers
  - One reaction per user per message (Telegram/WhatsApp style)
- **Files:** `backend/src/index.js`, `app/src/screens/ChatScreen.tsx`

---

## Jan 24, 2026 - Message Reactions, Replies, and Emoji Avatars

### Added: Message Reactions
- Telegram-style quick react bar (❤️ 🔥 💯 😂 👍 👎)
- Full emoji picker via menu
- Reactions display below messages with counts
- Backend stores: `{ "❤️": ["userId1"], "🔥": ["userId2"] }`

### Added: Reply to Messages
- Messages store `replyTo` field (message ID reference)
- Reply preview in input area when replying
- Quoted text above content with left border (Telegram-style)

### Added: Emoji Avatars
- EmojiPicker component (200+ emojis: faces, animals, objects, food, symbols)
- Avatar displays in: profile, chat messages, drawer, contacts list, header
- Tap large avatar in profile to change
- Small avatar next to incoming messages (Telegram-style)

### Added: Contact Renaming & Domain Resolution
- Local custom names (AsyncStorage per pubkey)
- .sol/.skr domain resolution (manual SNS, React Native compatible)
- Domain caching (AsyncStorage)
- Priority: Custom name > Domain > On-chain name > Pubkey

### Added: Enhanced Message Menu
- Reorganized: React → Reply → Copy → Pin → Delete
- Delete submenu: "Delete for Me" / "Delete for Everyone"
- Copy to clipboard (expo-clipboard)

**Files Created:**
- `app/src/components/EmojiPicker.tsx`
- `app/src/components/ReactionPicker.tsx`
- `app/src/hooks/useContactNames.ts`
- `app/src/utils/domains.ts`

**Dependencies:** expo-clipboard, js-sha256

---

## Jan 24, 2026 - Build System Improvements

### Added: Three-Tier Build System
1. **Regular build** (`npm run build`) - Fast, JS/TS changes only
2. **Gradle clean** (`npm run build:clean`) - Native module changes, build errors
3. **Prebuild clean** (`npm run build:prebuild`) - Nuclear option, regenerates /android

**Created:**
- `app/build-apk.sh` - Unified build script
- `app/BUILD.md` - Build decision tree and troubleshooting

---

## Jan 20, 2026 Night - Telegram-Style Sidebar Navigation

### Added: Drawer Navigation
- Telegram-style sidebar with hamburger menu
- Profile section at top (avatar, wallet address)
- Navigation: Chats, Contacts, Saved Messages, Settings, Invite Friends
- Nested Stack navigator for modal screens (Chat, AddContact, Profile)
- Dark theme matching Mukon brand

**Files:**
- Created: `app/src/components/CustomDrawer.tsx`
- Updated: `app/App.tsx` (DrawerNavigator + StackNavigator)
- Updated: `ContactsScreen.tsx` (removed profile FAB)
- Added: `@react-navigation/drawer`

---

## Jan 20, 2026 - Contact Blocking & Message Deletion

### Added: Contact Blocking System
- Added `PeerState::Blocked` to Solana program
- `block()` instruction - Symmetric operation, prevents re-invites until unblocked
- `unblock()` instruction - Changes Blocked → Rejected (allows re-invite)
- Updated `invite()` to check for blocked users
- Updated `reject()` to allow deleting accepted contacts (symmetric deletion)

### Added: Telegram-Style Message Deletion
- Delete for self: Removes from local state only
- Delete for everyone: Backend broadcasts to all clients (sender only)
- Long-press menu with delete submenu
- Backend `delete_message` handler

**Files:**
- `programs/mukon-messenger/src/lib.rs` (block/unblock instructions)
- `app/src/utils/transactions.ts` (block/unblock builders)
- `app/src/contexts/MessengerContext.tsx` (blockContact, unblockContact, deleteMessage)
- `backend/src/index.js` (delete_message handler)
- `app/src/screens/ChatScreen.tsx` (message deletion UI)

**Architecture:**
- Symmetric operations (affects both users)
- Mutable blocking (can unblock later)

---

## Jan 20, 2026 - Multiple Socket Instances Fix

### Fixed: Constant Wallet Auth Prompts
- **Problem:** Each screen created its own socket instance + encryption keys
- Multiple `useMukonMessenger` instances = auth on every screen navigation
- **Solution:** Created `MessengerContext` to centralize socket/encryption/state
- ONE socket instance for entire app
- ONE authentication on wallet connect
- Shared encryption keys across all components
- All screens use `useMessenger()` hook

**Files:**
- Created: `app/src/contexts/MessengerContext.tsx`
- Updated: `app/App.tsx` (wrapped with MessengerProvider)
- Updated: All screens to use `useMessenger()` hook

### Fixed: Second Wallet Decryption Failure
- **Problem:** Second wallet couldn't decrypt messages
- **Root Cause:** ChatScreen always used `contact.pubkey` as recipient, even for incoming
- **Solution:** Correctly determine recipient based on who sent message
```typescript
const recipientPubkey = isMe
  ? new PublicKey(contact.pubkey)  // You sent → recipient is contact
  : wallet.publicKey!;              // They sent → recipient is you
```
- **Result:** Both wallets can decrypt all messages correctly

### Fixed: Backend URL for Physical Device
- **Problem:** Hardcoded emulator address doesn't work for physical device
- **Solution:** Changed to host machine IP (check with `ifconfig`)
- **Note:** IP changes with network location

---

## Message Flow (Working as of Jan 20)

1. User types message in ChatScreen
2. `sendMessage()` encrypts with NaCl box using recipient's public key
3. Socket emits `send_message` with encrypted payload
4. Backend broadcasts to conversation room
5. Recipient's socket receives `new_message` event
6. Message decrypted with correct recipient key and displayed
7. Both sender/recipient can view history (properly encrypted/decrypted)

**Status:** ✅ E2E encrypted messaging working end-to-end!
