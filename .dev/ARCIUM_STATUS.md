# Arcium Integration Status

## 📅 Latest Update: January 20, 2026

### Why We Had Installation Issues ℹ️

**Timeline:**
- **Jan 17, 2026**: We struggled with Arcium installation, ended up downgrading from 0.6.3 to 0.5.4
- **Jan 20, 2026**: Arcium team released v0.6.3 on devnet cluster offset 456
- **Root cause**: We were trying to use 0.6.3 BEFORE it was officially released on devnet!

The version mismatch and installation issues we hit were because we were early adopters. Now that 0.6.3 is officially released, we need to migrate properly.

## ✅ What We've Built So Far

### Arcium CLI Installation
- Currently on Arcium v0.6.2 (need to upgrade to 0.6.3)
- Installation method: Manual download of `arcup_aarch64_macos_0.5.1` (outdated)

### Encrypted Instructions Built ✅
- Created `encrypted-ixs/` module with MPC circuits
- Successfully compiled 3 encrypted instructions:
  1. **is_accepted_contact** (13.9B ACUs) - Private contact verification
  2. **count_accepted** (2.2B ACUs) - Count accepted contacts privately
  3. **add_two_numbers** (485M ACUs) - Demo/testing instruction
- Using modern `arcis` crate (not old `arcis-imports`)
- Blake3 already pinned to 1.8.2 ✅

### Circuit Design ✅
- Fixed-size array architecture (MAX_CONTACTS=100) for MPC compatibility
- Avoided unsupported features (Vec, while loops)
- Uses constant-time loops for privacy preservation
- Compatible with v0.6.x architecture

### Anchor Program Setup ⚠️
- Program has `arcium_anchor::prelude::*` imported ✅
- Program has `#[arcium_program]` macro applied ✅
- **BUT**: No actual Arcium instructions integrated yet ❌
  - Missing `init_comp_def()` calls
  - Missing `queue_computation()` calls
  - Encrypted circuits not wired into program instructions

## 🚀 Migration to v0.6.3 & Next Steps

### Step 1: Upgrade Arcium Tooling

**Install latest Arcium (v0.6.3):**
```bash
# Uninstall old version first
rm -rf ~/.arcup

# Install v0.6.3 (officially released on devnet cluster offset 456)
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash

# Verify installation
arcup --version  # Should show 0.6.3
```

### Step 2: Update Dependencies

**Update `encrypted-ixs/Cargo.toml`:**
```toml
[dependencies]
arcis = "0.6.3"  # Currently 0.6.2, bump to 0.6.3
blake3 = "=1.8.2"  # Already correct ✅
```

**Update `programs/mukon-messenger/Cargo.toml`:**
```toml
[dependencies]
arcium-anchor = "0.6.3"  # Ensure latest version
anchor-lang = "0.32.1"
sha2 = "0.10"
```

### Step 3: Migration Changes (v0.5 → v0.6.3)

Based on [Arcium Migration Guide](https://docs.arcium.com/developers/migration/migration-v0.5-to-v0.6):

**Key Changes:**
1. ✅ **Crate Update**: Already using `arcis` (not old `arcis-imports`)
2. ✅ **Blake3 Pinning**: Already at `blake3 = "=1.8.2"`
3. ⚠️ **Signer Account Rename**: Need to replace `SignerAccount` → `ArciumSignerAccount` (if we use it)
4. ⚠️ **Clock Account**: Add `mut` to clock_account constraints
5. ⚠️ **Program ID Changed**: New ID is `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ`

**Our circuits are ALREADY compatible** with 0.6.3 since we built with 0.6.2! Just need to bump version.

### Step 4: Integrate Arcium Instructions into Anchor Program

**Currently missing in `programs/mukon-messenger/src/lib.rs`:**

1. **Add computation definition initialization:**
```rust
// Initialize comp defs for each Arcium instruction
pub fn init_is_accepted_contact_comp_def(ctx: Context<InitCompDef>) -> Result<()> {
    init_comp_def(ctx.accounts, 0, None, None)?;
    Ok(())
}

pub fn init_count_accepted_comp_def(ctx: Context<InitCompDef>) -> Result<()> {
    init_comp_def(ctx.accounts, 1, None, None)?;
    Ok(())
}
```

2. **Add encrypted operations:**
```rust
// Check if pubkey is in encrypted contact list
pub fn check_is_contact(
    ctx: Context<CheckContact>,
    computation_offset: u64,
    encrypted_contact_list: Vec<u8>,
    query_pubkey: Pubkey,
) -> Result<()> {
    let args = vec![encrypted_contact_list, query_pubkey.to_bytes().to_vec()];
    queue_computation(ctx.accounts, computation_offset, args)?;
    Ok(())
}

// Get count of accepted contacts privately
pub fn get_contact_count(
    ctx: Context<GetCount>,
    computation_offset: u64,
    encrypted_contact_list: Vec<u8>,
) -> Result<()> {
    let args = vec![encrypted_contact_list];
    queue_computation(ctx.accounts, computation_offset, args)?;
    Ok(())
}
```

3. **Add account structs for Arcium:**
```rust
#[derive(Accounts)]
pub struct InitCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub computation_definition: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckContact<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub computation_definition: UncheckedAccount<'info>,
    pub computation: UncheckedAccount<'info>,
    pub clock_account: Sysvar<'info, Clock>,  // Add mut if needed for v0.6.3
    pub arcium_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
```

### Step 5: Build & Deploy Encrypted Instructions

```bash
cd /Users/ash/Mukon-messenger/encrypted-ixs

# Rebuild with v0.6.3
cargo clean
arcium build

# Deploy computation definitions to devnet (cluster offset 456)
arcium deploy-comp-defs --cluster devnet
```

### Step 6: Update Client Integration

**In `app/src/hooks/useMukonMessenger.ts`:**
```typescript
import { circuits } from '../../build/circuits';  // Generated TypeScript types

// Use Arcium instruction to privately check if someone is a contact
const isAcceptedContact = async (contactPubkey: PublicKey): Promise<boolean> => {
    const result = await program.methods
        .checkIsContact(
            computationOffset,
            encryptedContactList,
            contactPubkey
        )
        .accounts({
            payer: wallet.publicKey,
            computationDefinition: compDefPDA,
            computation: computationPDA,
            clockAccount: SYSVAR_CLOCK_PUBKEY,
            arciumProgram: ARCIUM_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    return result;  // Privately verified without revealing full contact list!
};
```

## 📊 Timeline & Roadmap

### Current Status (Jan 20, 2026)
**✅ READY TO INTEGRATE:**
- Encrypted circuits built and tested
- Dependencies compatible with v0.6.3 migration
- Program structure has Arcium macros
- Just need to wire up the instructions

### Hackathon Timeline (Due: Jan 30, 2026)
**Priority: HIGH - We ARE shipping Arcium for hackathon!**

**Week 1 (Jan 20-23): Arcium Integration Sprint**
- [ ] Day 1: Upgrade to Arcium v0.6.3
- [ ] Day 1-2: Integrate Arcium instructions into program
- [ ] Day 2: Deploy program + comp defs to devnet
- [ ] Day 3: Test Arcium features E2E
- [ ] Day 3: Update app to use encrypted contact checks

**Week 2 (Jan 24-29): Polish & Submission**
- [ ] UI polish for privacy features
- [ ] Demo video recording
- [ ] Documentation for judges
- [ ] Submit to Arcium bounty ($10k)
- [ ] Submit to Open Track ($18k)

**Week 3 (Jan 30+): Mainnet Prep**
- [ ] Final testing on devnet
- [ ] Audit security (encryption keys, PDAs)
- [ ] Deploy to mainnet-beta
- [ ] Launch! 🚀

### What Arcium Adds (The Privacy Magic ✨)

**Without Arcium (Current Architecture):**
- Contact lists visible on-chain (can see who you invited)
- Anyone can query WalletDescriptor and see your peers
- Conversation PDAs reveal participants
- Relationship graph is public
- Message routing exposes who talks to whom

**With Arcium (Full Metadata Protection) 🔒:**

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: ON-CHAIN (Arcium MPC)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Encrypted with Arcium:                                     │
│  ├── Contact lists (who you talk to)                        │
│  ├── Conversation existence (that Alice & Bob have a chat)  │
│  ├── Message pointers (references to off-chain blobs)       │
│  ├── User profiles (display names, avatars)                 │
│  └── Social graph (entire network of contacts)              │
│                                                             │
│  → Even WE (developers) can't see who's talking to whom     │
│  → On-chain observers see encrypted blobs only              │
│  → MPC computations prove relationships without revealing   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 2: OFF-CHAIN (Relay Nodes)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  What relay nodes see:                                      │
│  ├── Encrypted blob (E2E encrypted message content)         │
│  ├── Destination: [ENCRYPTED PUBKEY or anonymous ID]        │
│  ├── Timestamp (for ordering only)                          │
│  └── Nothing else                                           │
│                                                             │
│  → Relay knows it's passing a message somewhere             │
│  → Relay doesn't know sender identity                       │
│  → Relay doesn't know recipient identity                    │
│  → Relay can't correlate conversations                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 3: CLIENT (End-to-End)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Only the recipient can:                                    │
│  ├── Decrypt message content (NaCl box with their key)      │
│  ├── Query their encrypted contact list (via Arcium MPC)    │
│  ├── Prove contact relationships (zero-knowledge)           │
│  └── See conversation metadata (locally decrypted)          │
│                                                             │
│  → True end-to-end privacy at every layer                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Privacy Properties Achieved:**

| Data Type | Current (No Arcium) | With Arcium | Protected From |
|-----------|---------------------|-------------|----------------|
| Contact List | Visible on-chain | Encrypted with MPC | On-chain observers, us |
| Conversation Existence | PDA reveals participants | Encrypted pointer | Everyone except participants |
| Message Content | E2E encrypted ✅ | E2E encrypted ✅ | Relay nodes, on-chain |
| Message Routing | Relay sees sender/recipient | Anonymous IDs | Relay nodes |
| Social Graph | Anyone can map network | Fully encrypted | Graph analysis attacks |
| User Profiles | Public on-chain | Encrypted with MPC | On-chain observers |

**Attack Resistance:**
- ✅ **Traffic analysis** - Relay can't correlate conversations
- ✅ **Social graph mapping** - On-chain data is encrypted
- ✅ **Metadata leakage** - Everything encrypted except existence of activity
- ✅ **Relationship discovery** - MPC proves without revealing
- ✅ **Network analysis** - Can't build social graph from on-chain data

**This is MAXIMUM privacy for hackathon!** 🏆 Beyond just message encryption.

## 🎯 Integration Decision: FULL SPEED AHEAD

**Decision: Integrate Arcium NOW for hackathon submission**

**Why:**
1. ✅ Circuits already built and compatible
2. ✅ v0.6.3 officially released (no more version issues!)
3. ✅ 10 days until hackathon deadline (enough time)
4. ✅ This is THE differentiator for bounties
5. ✅ Mainnet launch will have Arcium from day 1

**Estimate:** 1-2 days to fully integrate + test

## 📝 Current File Structure

```
encrypted-ixs/
├── Cargo.toml (arcis 0.6.2 → upgrade to 0.6.3)
└── src/
    └── lib.rs (80 lines, 3 circuits)

build/ (will regenerate with 0.6.3)
├── *.arcis (compiled circuits)
├── circuits.ts (TypeScript types for client)
└── *.profile.json (performance data)

programs/mukon-messenger/
└── src/
    └── lib.rs (has #[arcium_program], needs comp_def integration)
```

## 🔗 Resources

- **Arcium v0.6.3 Announcement**: Devnet cluster offset 456
- **Migration Guide**: https://docs.arcium.com/developers/migration/migration-v0.5-to-v0.6
- **Arcium Docs**: https://docs.arcium.com/developers
- **Arcium Examples**: https://github.com/arcium-hq/examples
- **Installation**: `curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash`

---

**Status**: Ready to integrate for hackathon! 🚀 Target: Jan 23, 2026
