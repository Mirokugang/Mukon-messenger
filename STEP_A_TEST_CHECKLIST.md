# Step A Testing Checklist - On-Chain Group Key Backup

## Test Environment Setup
- [ ] Backend running (check IP in `app/src/config.ts`)
- [ ] Program deployed to devnet: `GCTzU7Y6yaBNzW6WA1EJR6fnY9vLNZEEPcgsydCD8mpj`
- [ ] App rebuilt with new code (`npm run build` in app directory)
- [ ] 3 wallets ready (Admin, Member1, Member2)

---

## Phase 1: Key Storage (NO app data deletion needed)

**Purpose:** Verify encrypted keys are being stored on-chain

### Test 1.1: Admin Key Storage on Group Creation
- [ ] **Admin:** Create new group with 2 members
- [ ] **Check logs:** Look for `💾 Stored admin's encrypted group key on-chain`
- [ ] **Verify on-chain:** Query GroupKeyShare PDA for admin
  ```bash
  # In separate terminal, check Solana Explorer or use:
  # PDA seeds: ["group_key", group_id, admin_pubkey, [1]]
  ```
- [ ] **Expected:** Admin's encrypted key share exists on-chain

### Test 1.2: Member Key Storage on Key Receipt
- [ ] **Member1 & Member2:** Accept group invitations
- [ ] **Member1:** Check logs for `✅ Group key decrypted and stored`
- [ ] **Member1:** Check logs for `💾 Stored encrypted group key on-chain for recovery`
- [ ] **Member2:** Same checks as Member1
- [ ] **Expected:** All 3 members now have encrypted keys stored on-chain

### Test 1.3: Send Messages (Baseline)
- [ ] **All members:** Send a few messages in the group
- [ ] **Expected:** All members can encrypt/decrypt messages normally

---

## Phase 2: Key Recovery (REQUIRES app data deletion)

**Purpose:** Verify keys can be recovered from on-chain after data loss

### Test 2.1: Simulate Data Loss
- [ ] **Member1:** Note down the group ID (you'll need it to verify)
- [ ] **Member1:** Clear app data + cache (Settings → Apps → Mukon → Clear Data)
- [ ] **Member1:** Reinstall app OR just reopen (depends on platform)

### Test 2.2: Reconnect and Recover
- [ ] **Member1:** Connect wallet (same wallet as before)
- [ ] **Member1:** Check logs for `🔍 Missing key for group...`
- [ ] **Member1:** Check logs for `✅ Recovered group key from on-chain`
- [ ] **Expected:** Group appears in contacts list
- [ ] **Expected:** Can see group in conversations

### Test 2.3: Decrypt Old Messages
- [ ] **Member1:** Open the group chat
- [ ] **Member1:** Verify old messages are readable (not showing "Encrypted")
- [ ] **Expected:** All previous messages decrypt correctly

### Test 2.4: Send New Messages
- [ ] **Member1:** Send a new message
- [ ] **Member2 & Admin:** Receive and decrypt the message
- [ ] **Expected:** Member1 can still participate in group after recovery

---

## Phase 3: Cleanup (Rent Recovery)

**Purpose:** Verify GroupKeyShare accounts are closed properly

### Test 3.1: Leave Group and Recover Rent
- [ ] **Member2:** Check SOL balance before leaving
- [ ] **Member2:** Leave the group
- [ ] **Member2:** Check logs for transaction confirmation
- [ ] **Member2:** Check SOL balance after leaving
- [ ] **Expected:** SOL balance increased (rent recovered from GroupKeyShare account)
- [ ] **Verify on-chain:** Member2's GroupKeyShare PDA should be closed

### Test 3.2: Verify Group Still Works
- [ ] **Admin & Member1:** Continue sending messages
- [ ] **Expected:** Group functions normally with remaining members

---

## Phase 4: Edge Cases

### Test 4.1: Multiple Groups Recovery
- [ ] **Admin:** Create 2 more groups (Group B, Group C)
- [ ] **Member1:** Join both groups, verify keys stored
- [ ] **Member1:** Clear app data again
- [ ] **Member1:** Reconnect wallet
- [ ] **Expected:** All 3 groups recovered from on-chain

### Test 4.2: No On-Chain Backup (Old Group)
- [ ] **Create scenario:** Join a group but DON'T let key storage complete
- [ ] **Clear app data**
- [ ] **Expected:** Log shows `⚠️ No on-chain key backup found for group...`

---

## Success Criteria

✅ **All Phase 1 tests pass** → Keys are being stored on-chain
✅ **All Phase 2 tests pass** → Keys can be recovered after data loss
✅ **All Phase 3 tests pass** → Cleanup works, rent recovered
✅ **No errors in logs** (except expected warnings for missing backups)

---

## Common Issues & Solutions

**Issue:** "Failed to store group key on-chain"
- **Check:** Wallet has enough SOL for rent (~0.002 SOL per GroupKeyShare)
- **Check:** Program deployed correctly (discriminators updated)

**Issue:** "Failed to decrypt on-chain key"
- **Cause:** Encryption keys derived from different signature
- **Fix:** Ensure same wallet connected (same signature)

**Issue:** "No on-chain key backup found"
- **Cause:** Key storage transaction failed silently (non-fatal error)
- **Fix:** Check earlier logs for "Failed to store group key on-chain"

**Issue:** Group recovered but messages show "Encrypted"
- **Cause:** Key decryption failed OR wrong key recovered
- **Debug:** Check if groupId matches, check encryption public key

---

## Quick Answer to Your Question

**Should you delete app data or just login with same accounts?**

➡️ **Do BOTH:**
1. **Phase 1 (No deletion):** Test with same accounts to verify keys are stored on-chain
2. **Phase 2 (With deletion):** Delete app data to test recovery from on-chain

Start with Phase 1 first - this verifies the storage mechanism works before testing recovery.
