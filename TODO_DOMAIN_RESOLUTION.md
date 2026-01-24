# TODO: Fix Domain Resolution

## Current Issue (Jan 24, 2026)

Domain resolution not working for .sol/.skr domains:
- `airdrops.skr` should resolve to `Hg6owJ8Z1xiWfz8qBKu1SkSaPtYs5pHya7VS6gcD6KGY`
- `ninja27.skr` should resolve to `H41HCgmB1s2h8FCNR9eMtRMfiLAHBhyeWwCcCj3cCuoZ`

Currently returns "Domain not found" even with mainnet connection.

## Possible Issues

1. **Hashing implementation:** `js-sha256` might return wrong format
   - Need to verify seed construction matches Bonfida SDK exactly
   - Check if we need to hash the full input differently

2. **`.skr` domains:** Might use different registry than `.sol`
   - Research if .skr uses Bonfida or different service
   - May need separate resolution logic

3. **Account deserialization:** NameRegistryState layout might be wrong
   - Owner offset might not be at bytes 32-64
   - Need to verify actual on-chain data structure

## Quick Fix Options

**Option 1: Use `@bonfida/spl-name-service` via polyfills**
- Install React Native crypto polyfills
- May cause bundle size issues

**Option 2: Just support raw public keys for MVP**
- Skip domain resolution for hackathon
- Add later when we have more time

**Option 3: Backend proxy for domain resolution**
- Backend resolves domains (has Node.js with full crypto)
- App sends domain to backend, gets pubkey back
- Quick but adds dependency

## Testing Plan

When we deploy to mainnet:
1. Test with known .sol domain
2. Test with known .skr domain
3. Verify resolved pubkey matches Solscan
4. Add unit tests for domain resolution

## References

- Bonfida SNS SDK: https://github.com/Bonfida/sns-sdk
- SNS Program: `namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX`
- Solscan API for verification

---

**Status:** Deprioritized for hackathon
**Will test:** During mainnet deployment
