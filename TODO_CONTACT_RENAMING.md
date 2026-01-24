# TODO: On-Chain Contact Renaming

## Current Implementation (Local)
✅ Contact custom names stored in AsyncStorage
✅ Priority: Custom name > Domain > On-chain name > Pubkey
✅ Works offline, instant updates
✅ Local only - doesn't sync across devices

## Future: On-Chain Implementation

### Option 1: Add to WalletDescriptor.Peer
```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Peer {
    pub wallet: Pubkey,
    pub state: PeerState,
    pub custom_name: Option<String>,  // NEW: max 32 chars
}
```

**Pros:**
- Syncs across devices
- Stored in user's own account (no privacy leak)
- Can update via new instruction

**Cons:**
- Requires on-chain transaction to rename
- Costs SOL for tx fees
- Realloc account space (complex)

### Option 2: Separate CustomNames Account
```rust
#[account]
pub struct CustomContactNames {
    pub owner: Pubkey,
    pub names: Vec<ContactNameEntry>,  // Encrypted with Arcium?
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ContactNameEntry {
    pub contact_pubkey: Pubkey,
    pub custom_name: String,
}
```

**Pros:**
- Doesn't require realloc of WalletDescriptor
- Can add/update names without touching contact state
- Could be encrypted with Arcium for privacy

**Cons:**
- Extra account to manage
- More complex lookups

### Recommendation
**Start with Option 1 when deploying to mainnet:**
1. Add `custom_name: Option<String>` to Peer struct
2. Add `set_contact_name()` instruction
3. Client loads on-chain name, falls back to local AsyncStorage
4. Migration: When user renames on-chain, clear AsyncStorage version

### Implementation Steps
1. Update Peer struct in lib.rs
2. Add `set_contact_name(peer: Pubkey, custom_name: String)` instruction
3. Update WalletDescriptor deserialization to read custom_name
4. Update client to prefer on-chain name over local
5. Add "Sync to Blockchain" button in rename dialog (optional)

### Privacy Consideration with Arcium
**Do we encrypt custom names?**
- **NO** - Custom names are local labels, not sensitive
- Contact list itself is encrypted (Arcium), but custom labels don't leak metadata
- Similar to how phone contacts have custom names locally

---

**Status:** Local implementation complete (Jan 24, 2026)
**Target for on-chain:** Post-hackathon / Mainnet launch
