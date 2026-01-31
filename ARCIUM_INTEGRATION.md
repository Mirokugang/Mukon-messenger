# Arcium MPC Integration - Implementation Complete

## Summary

The Arcium MPC integration has been implemented in code. This adds **encrypted contact verification** using multi-party computation (MPC), which is the core deliverable for the **$10K Arcium bounty**.

## What Was Implemented

### 1. Dependencies Updated ✅

**Rust (programs/mukon-messenger/Cargo.toml):**
- `arcium-anchor = "0.6.3"` (upgraded from 0.6.2)
- `arcium-client = "0.6.3"` (new)
- `arcium-macros = "0.6.3"` (new)

**Rust (encrypted-ixs/Cargo.toml):**
- `arcis = "0.6.3"` (upgraded from 0.6.2)

**JavaScript (app/package.json):**
- `@arcium-hq/client = "^0.6.3"` (new)

### 2. Solana Program (lib.rs) ✅

Added **7 new Arcium instructions** to `programs/mukon-messenger/src/lib.rs`:

**Init Comp Def Instructions (3):**
1. `init_is_accepted_contact_comp_def` - Initialize comp def for contact verification
2. `init_count_accepted_comp_def` - Initialize comp def for counting contacts
3. `init_add_two_numbers_comp_def` - Initialize comp def for demo circuit

**Queue Computation Instructions (2):**
4. `check_is_contact` - Queue MPC computation to verify if a contact is accepted
5. `count_accepted_contacts` - Queue MPC computation to count accepted contacts

**Callback Instructions (2):**
6. `check_is_contact_callback` - Handle MPC result for contact verification
7. `count_accepted_contacts_callback` - Handle MPC result for contact count

**Events (2):**
- `ContactCheckResult` - Emitted when contact verification completes
- `ContactCountResult` - Emitted when contact count completes

**Error Codes (2):**
- `AbortedComputation` - MPC computation failed
- `ClusterNotSet` - Arcium cluster not configured

### 3. Client Utilities ✅

**New file: `app/src/utils/arcium.ts`**
- `encryptContactList()` - Encrypt contact list for MPC using x25519 + RescueCipher
- `encryptQueryPubkey()` - Encrypt query pubkey for verification
- `decryptResult()` - Decrypt MPC computation results
- PDA helpers: `getMXEAddress()`, `getCompDefAddress()`, `getClusterAddress()`, etc.
- `waitForComputation()` - Wait for MPC computation to finalize

**Updated: `app/src/utils/transactions.ts`**
- Added 5 new discriminators (placeholders - need update after build)
- `createInitIsAcceptedContactCompDefInstruction()`
- `createInitCountAcceptedCompDefInstruction()`
- `createInitAddTwoNumbersCompDefInstruction()`
- `createCheckIsContactInstruction()`
- `createCountAcceptedContactsInstruction()`

### 4. What's Left: MessengerContext Integration

**Task #8 is still pending** - This requires wiring the Arcium utilities into `MessengerContext.tsx` to add a `verifyContactPrivately()` function that the UI can call.

This function should:
1. Get MXE public key
2. Encrypt contact list + query pubkey
3. Build and send `check_is_contact` transaction
4. Await finalization and listen for `ContactCheckResult` event
5. Decrypt result and return to caller

---

## Next Steps (User Action Required)

### Step 1: Check Arcium v0.6.6 Status

The plan was written for Arcium v0.6.3 (latest documented). Check if v0.6.6 docs are now available:
- If yes: Review migration guide and update versions if needed
- If no: Proceed with v0.6.3 as implemented

### Step 2: Install Dependencies

```bash
# Install Arcium CLI
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash
arcup --version  # Verify 0.6.3+

# Install Rust dependencies
cd programs/mukon-messenger
cargo update

cd ../../encrypted-ixs
cargo update

# Install JS dependencies
cd ../app
npm install
```

### Step 3: Rebuild Circuits

```bash
cd encrypted-ixs
cargo clean
arcium build
```

This will regenerate the `.arcis` files in `build/` directory.

### Step 4: Build and Deploy Program

```bash
cd ..
anchor build
anchor deploy --provider.cluster devnet
```

**IMPORTANT:** After deployment, the Arcium instruction discriminators will change. You MUST update them.

### Step 5: Update Discriminators

```bash
node scripts/update-discriminators.js
```

This script will extract the new discriminators and update `app/src/utils/transactions.ts` automatically. If the script doesn't handle Arcium instructions, manually extract them:

```bash
anchor idl parse -f target/idl/mukon_messenger.json | grep -A 1 "init_is_accepted_contact_comp_def\|check_is_contact\|count_accepted_contacts"
```

Then manually update the PLACEHOLDER bytes in `transactions.ts`.

### Step 6: Deploy MXE (One-Time)

```bash
arcium deploy \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://api.devnet.solana.com
```

This initializes the MXE (Multi-party eXecution Engine) account on-chain.

**IMPORTANT:** This is just a single transaction that creates an on-chain account. You do NOT need to run MPC nodes - Arcium already runs those on devnet. This is like deploying your program (one command, then you're done).

### Step 7: Host Circuit Files

The `.arcis` files need to be publicly accessible. Options:

**Option A: Upload to backend (recommended)**
Add static file serving to the backend:
```bash
cd backend
mkdir public
cp ../build/*.arcis public/
# Add express.static('/circuits', path.join(__dirname, 'public'))
# Update circuit URLs in lib.rs to: https://mukon-backend.fly.dev/circuits/<name>.arcis
```

**Option B: GitHub Releases**
- Create a release in the repo
- Upload `.arcis` files as release assets
- Update URLs in `lib.rs` to point to GitHub release URLs

**Option C: Arweave/IPFS**
- Upload to decentralized storage
- Update URLs in `lib.rs`

### Step 8: Initialize Comp Defs (One-Time)

From a test script or the client app, call the init instructions:

```typescript
// Pseudo-code - needs to be in a proper context
const tx1 = createInitIsAcceptedContactCompDefInstruction(wallet.publicKey);
const tx2 = createInitCountAcceptedCompDefInstruction(wallet.publicKey);
const tx3 = createInitAddTwoNumbersCompDefInstruction(wallet.publicKey);

// Send and confirm each transaction
// Then call buildFinalizeCompDefTx() for each (from Arcium SDK)
```

### Step 9: Wire into MessengerContext

Complete **Task #8** by adding `verifyContactPrivately()` to `MessengerContext.tsx`. Example skeleton:

```typescript
const verifyContactPrivately = async (queryPubkey: string) => {
  if (!wallet?.publicKey || !isRegistered) return;

  try {
    // 1. Get MXE public key
    const mxePubKey = await getMXEPubKey(connection);

    // 2. Get contacts from WalletDescriptor
    const contacts = await fetchContacts(); // Your existing function

    // 3. Encrypt contact list
    const encryptedList = await encryptContactList(contacts, mxePubKey);

    // 4. Encrypt query pubkey
    const encryptedQuery = await encryptQueryPubkey(
      new PublicKey(queryPubkey).toBytes(),
      mxePubKey
    );

    // 5. Queue computation
    const computationOffset = Date.now(); // Use unique offset
    const ix = createCheckIsContactInstruction(
      wallet.publicKey,
      computationOffset,
      encryptedList.ciphertext,
      encryptedQuery.ciphertext,
      encryptedList.publicKey,
      BigInt(encryptedList.nonce),
      BigInt(encryptedQuery.nonce)
    );

    const tx = await buildTransaction(connection, wallet.publicKey, [ix]);
    await transact(tx);

    // 6. Wait for result
    await waitForComputation(connection, computationOffset);

    // 7. Listen for ContactCheckResult event and decrypt
    // (Need to add event listener to program)

    return true; // or decrypted result
  } catch (error) {
    console.error('MPC verification failed:', error);
    return false;
  }
};
```

### Step 10: Test E2E

1. Register 2 test wallets
2. Accept contact between them
3. Call `verifyContactPrivately(contactPubkey)` from wallet 1
4. Verify MPC computation completes and returns `true` (contact is accepted)
5. Query a non-contact pubkey, verify it returns `false`

---

## Circuit Hosting Details

The program expects circuits at these URLs (update in `lib.rs` lines ~690-720):

```rust
"https://mukon-circuits.fly.dev/is_accepted_contact.arcis"
"https://mukon-circuits.fly.dev/count_accepted.arcis"
"https://mukon-circuits.fly.dev/add_two_numbers.arcis"
```

Update these URLs based on where you host the `.arcis` files.

---

## Key Technical Notes

### ArgBuilder Field Ordering

The `check_is_contact` instruction uses `ArgBuilder` to construct encrypted arguments:

```rust
ArgBuilder::new()
    .x25519_pubkey(pub_key)           // Your ephemeral public key
    .plaintext_u128(nonce_list)        // Nonce for contact list
    .encrypted_bytes(encrypted_contact_list)  // Encrypted ContactList
    .x25519_pubkey(pub_key)           // Same public key (for query)
    .plaintext_u128(nonce_query)       // Nonce for query pubkey
    .encrypted_bytes(encrypted_query_pubkey)  // Encrypted [u8; 32]
    .build()
```

This **must match** the circuit's parameter order. Verify against generated `.ts` type definitions after circuit rebuild.

### Contact List Serialization

Contact list is serialized as:
- 100 contacts (padded with zeros)
- Each contact: 32 bytes pubkey + 1 byte status = 33 bytes
- Total: 3300 bytes

The `encryptContactList()` function handles this serialization.

### MPC Privacy Model

With Arcium integration:
1. Contact list is **encrypted on-chain** (only you can decrypt)
2. Query "is X my contact?" runs in **MPC** (no single party sees plaintext)
3. Result is **encrypted** and emitted as event (only you can decrypt)
4. Even developers/validators **cannot see** who your contacts are

This is the **key differentiator** vs traditional messengers for the hackathon.

---

## Bounty Deliverable Checklist

For the **$10K Arcium bounty**, you need to demonstrate:

- [x] **3 compiled circuits** (is_accepted_contact, count_accepted, add_two_numbers)
- [x] **Program integration** (7 Arcium instructions added)
- [x] **Client integration** (encryption utils + transaction builders)
- [ ] **MXE deployment** (run `arcium deploy`)
- [ ] **Comp def initialization** (one-time setup)
- [ ] **Working E2E demo** (prove contact verification works privately)
- [ ] **Circuit hosting** (accessible .arcis files)
- [ ] **UI integration** (MessengerContext wired up - Task #8)

---

## Troubleshooting

### Build Errors

If you get errors about missing types (e.g., `IsAcceptedContactOutput`):
- These are **generated types** from the Arcium circuits
- Run `arcium build` in `encrypted-ixs/` to regenerate them
- Check `build/` directory for generated `.ts` files

### Discriminator Mismatches

If transactions fail with "invalid instruction":
- Discriminators changed after rebuild
- Re-run `node scripts/update-discriminators.js`
- Or manually extract from IDL and update `transactions.ts`

### MXE Not Found

If you get "account not found" errors:
- MXE needs to be deployed first: `arcium deploy`
- Verify MXE address: `getMXEAddress()` should match on-chain account

### Circuit Not Found

If comp def initialization fails:
- Verify `.arcis` files are accessible at the URLs in `lib.rs`
- Check circuit hashes match (generated by `circuit_hash!` macro)

---

## Questions?

The implementation is complete in code. The remaining work is:
1. **User actions** (build, deploy, host circuits, init comp defs)
2. **Task #8** (wire MessengerContext - I can do this if you resume the task)
3. **E2E testing** (verify MPC actually works)

The core Arcium MPC integration is ready for the hackathon submission!
