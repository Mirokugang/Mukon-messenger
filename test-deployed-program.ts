import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import IDL from "./target/idl/mukon_messenger.json";

const PROGRAM_ID = new PublicKey("89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const WALLET_DESCRIPTOR_VERSION = Buffer.from([1]);
const USER_PROFILE_VERSION = Buffer.from([1]);

async function testDeployedProgram() {
  console.log("🧪 Testing deployed Mukon Messenger program...\n");

  // Create test wallet
  const testUser = Keypair.generate();
  console.log(`Test wallet: ${testUser.publicKey.toBase58()}`);

  // Airdrop SOL
  console.log("Requesting airdrop...");
  try {
    const signature = await connection.requestAirdrop(
      testUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    console.log("✅ Airdrop received\n");
  } catch (error) {
    console.error("❌ Airdrop failed:", error.message);
    console.log("Note: Devnet faucet may be rate-limited. Try web faucet.\n");
    return;
  }

  // Setup program
  const wallet = new anchor.Wallet(testUser);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(IDL as any, PROGRAM_ID, provider);

  // Derive PDAs
  const [walletDescriptor] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("wallet_descriptor"),
      testUser.publicKey.toBuffer(),
      WALLET_DESCRIPTOR_VERSION,
    ],
    PROGRAM_ID
  );

  const [userProfile] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_profile"),
      testUser.publicKey.toBuffer(),
      USER_PROFILE_VERSION,
    ],
    PROGRAM_ID
  );

  // Test 1: Register user
  console.log("Test 1: Registering user...");
  try {
    const tx = await program.methods
      .register("TestUser")
      .accounts({
        walletDescriptor,
        userProfile,
        payer: testUser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ User registered! TX: ${tx.slice(0, 20)}...`);
  } catch (error) {
    console.error("❌ Registration failed:", error.message);
    return;
  }

  // Test 2: Fetch profile
  console.log("\nTest 2: Fetching user profile...");
  try {
    const profile = await program.account.userProfile.fetch(userProfile);
    console.log(`✅ Profile fetched: ${profile.displayName}`);
    console.log(`   Owner: ${profile.owner.toBase58().slice(0, 20)}...`);
  } catch (error) {
    console.error("❌ Profile fetch failed:", error.message);
    return;
  }

  // Test 3: Fetch wallet descriptor
  console.log("\nTest 3: Fetching wallet descriptor...");
  try {
    const descriptor = await program.account.walletDescriptor.fetch(
      walletDescriptor
    );
    console.log(`✅ Descriptor fetched`);
    console.log(`   Owner: ${descriptor.owner.toBase58().slice(0, 20)}...`);
    console.log(`   Peers count: ${descriptor.peers.length}`);
  } catch (error) {
    console.error("❌ Descriptor fetch failed:", error.message);
    return;
  }

  console.log("\n🎉 All tests passed! Deployed program is functional.\n");
  console.log("Next steps:");
  console.log("1. Start backend: cd backend && node src/index.js");
  console.log("2. Launch app: cd app && npx expo start");
  console.log("3. Test full E2E flow with mobile app");
}

testDeployedProgram().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
