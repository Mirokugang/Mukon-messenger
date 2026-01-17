import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MukonMessenger } from "../target/types/mukon_messenger";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("mukon-messenger", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MukonMessenger as Program<MukonMessenger>;

  // Test wallets
  const alice = Keypair.generate();
  const bob = Keypair.generate();

  const WALLET_DESCRIPTOR_VERSION = Buffer.from([1]);
  const USER_PROFILE_VERSION = Buffer.from([1]);
  const CONVERSATION_VERSION = Buffer.from([1]);

  // Helper function to get chat hash
  function getChatHash(a: PublicKey, b: PublicKey): Buffer {
    const crypto = require('crypto');
    const combined = Buffer.alloc(64);

    // Sort pubkeys deterministically
    if (a.toBuffer().compare(b.toBuffer()) < 0) {
      a.toBuffer().copy(combined, 0);
      b.toBuffer().copy(combined, 32);
    } else {
      b.toBuffer().copy(combined, 0);
      a.toBuffer().copy(combined, 32);
    }

    return crypto.createHash('sha256').update(combined).digest();
  }

  // Get PDAs for Alice
  const [aliceWalletDescriptor] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_descriptor"), alice.publicKey.toBuffer(), WALLET_DESCRIPTOR_VERSION],
    program.programId
  );

  const [aliceUserProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), alice.publicKey.toBuffer(), USER_PROFILE_VERSION],
    program.programId
  );

  // Get PDAs for Bob
  const [bobWalletDescriptor] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_descriptor"), bob.publicKey.toBuffer(), WALLET_DESCRIPTOR_VERSION],
    program.programId
  );

  const [bobUserProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), bob.publicKey.toBuffer(), USER_PROFILE_VERSION],
    program.programId
  );

  before(async () => {
    // Airdrop SOL to test wallets
    const airdropAlice = await provider.connection.requestAirdrop(
      alice.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropAlice);

    const airdropBob = await provider.connection.requestAirdrop(
      bob.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBob);
  });

  it("Registers Alice with a display name", async () => {
    const displayName = "Alice";

    await program.methods
      .register(displayName)
      .accounts({
        walletDescriptor: aliceWalletDescriptor,
        userProfile: aliceUserProfile,
        payer: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Verify wallet descriptor
    const walletDescriptor = await program.account.walletDescriptor.fetch(aliceWalletDescriptor);
    assert.ok(walletDescriptor.owner.equals(alice.publicKey));
    assert.equal(walletDescriptor.peers.length, 0);

    // Verify user profile
    const userProfile = await program.account.userProfile.fetch(aliceUserProfile);
    assert.ok(userProfile.owner.equals(alice.publicKey));
    assert.equal(userProfile.displayName, displayName);
  });

  it("Registers Bob with a display name", async () => {
    const displayName = "Bob";

    await program.methods
      .register(displayName)
      .accounts({
        walletDescriptor: bobWalletDescriptor,
        userProfile: bobUserProfile,
        payer: bob.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Verify
    const userProfile = await program.account.userProfile.fetch(bobUserProfile);
    assert.equal(userProfile.displayName, displayName);
  });

  it("Alice updates her profile", async () => {
    const newDisplayName = "Alice Smith";
    const avatarUrl = "https://example.com/avatar.png";

    await program.methods
      .updateProfile(newDisplayName, avatarUrl)
      .accounts({
        userProfile: aliceUserProfile,
        payer: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    const userProfile = await program.account.userProfile.fetch(aliceUserProfile);
    assert.equal(userProfile.displayName, newDisplayName);
    assert.equal(userProfile.avatarUrl, avatarUrl);
  });

  it("Alice invites Bob", async () => {
    const chatHash = getChatHash(alice.publicKey, bob.publicKey);

    const [conversation] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversation"), chatHash, CONVERSATION_VERSION],
      program.programId
    );

    await program.methods
      .invite(Array.from(chatHash))
      .accounts({
        payer: alice.publicKey,
        invitee: bob.publicKey,
        payerDescriptor: aliceWalletDescriptor,
        inviteeDescriptor: bobWalletDescriptor,
        conversation,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Verify Alice's descriptor shows invited state
    const aliceDescriptor = await program.account.walletDescriptor.fetch(aliceWalletDescriptor);
    assert.equal(aliceDescriptor.peers.length, 1);
    assert.ok(aliceDescriptor.peers[0].wallet.equals(bob.publicKey));
    assert.deepEqual(aliceDescriptor.peers[0].state, { invited: {} });

    // Verify Bob's descriptor shows requested state
    const bobDescriptor = await program.account.walletDescriptor.fetch(bobWalletDescriptor);
    assert.equal(bobDescriptor.peers.length, 1);
    assert.ok(bobDescriptor.peers[0].wallet.equals(alice.publicKey));
    assert.deepEqual(bobDescriptor.peers[0].state, { requested: {} });

    // Verify conversation was created
    const conv = await program.account.conversation.fetch(conversation);
    assert.ok(conv.participants[0].equals(alice.publicKey) || conv.participants[1].equals(alice.publicKey));
    assert.ok(conv.participants[0].equals(bob.publicKey) || conv.participants[1].equals(bob.publicKey));
  });

  it("Bob accepts Alice's invitation", async () => {
    await program.methods
      .accept()
      .accounts({
        payer: bob.publicKey,
        peer: alice.publicKey,
        payerDescriptor: bobWalletDescriptor,
        peerDescriptor: aliceWalletDescriptor,
      })
      .signers([bob])
      .rpc();

    // Verify both descriptors show accepted state
    const aliceDescriptor = await program.account.walletDescriptor.fetch(aliceWalletDescriptor);
    assert.deepEqual(aliceDescriptor.peers[0].state, { accepted: {} });

    const bobDescriptor = await program.account.walletDescriptor.fetch(bobWalletDescriptor);
    assert.deepEqual(bobDescriptor.peers[0].state, { accepted: {} });
  });

  it("Cannot invite the same person twice", async () => {
    const charlie = Keypair.generate();

    // Airdrop to Charlie
    const airdrop = await provider.connection.requestAirdrop(
      charlie.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    // Register Charlie
    const [charlieWalletDescriptor] = PublicKey.findProgramAddressSync(
      [Buffer.from("wallet_descriptor"), charlie.publicKey.toBuffer(), WALLET_DESCRIPTOR_VERSION],
      program.programId
    );

    const [charlieUserProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), charlie.publicKey.toBuffer(), USER_PROFILE_VERSION],
      program.programId
    );

    await program.methods
      .register("Charlie")
      .accounts({
        walletDescriptor: charlieWalletDescriptor,
        userProfile: charlieUserProfile,
        payer: charlie.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([charlie])
      .rpc();

    // Alice invites Charlie
    const chatHash1 = getChatHash(alice.publicKey, charlie.publicKey);
    const [conversation1] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversation"), chatHash1, CONVERSATION_VERSION],
      program.programId
    );

    await program.methods
      .invite(Array.from(chatHash1))
      .accounts({
        payer: alice.publicKey,
        invitee: charlie.publicKey,
        payerDescriptor: aliceWalletDescriptor,
        inviteeDescriptor: charlieWalletDescriptor,
        conversation: conversation1,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Try to invite again - should fail (already invited error)
    try {
      const chatHash2 = getChatHash(alice.publicKey, charlie.publicKey);
      const [conversation2] = PublicKey.findProgramAddressSync(
        [Buffer.from("conversation"), chatHash2, CONVERSATION_VERSION],
        program.programId
      );

      await program.methods
        .invite(Array.from(chatHash2))
        .accounts({
          payer: alice.publicKey,
          invitee: charlie.publicKey,
          payerDescriptor: aliceWalletDescriptor,
          inviteeDescriptor: charlieWalletDescriptor,
          conversation: conversation2,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      assert.fail("Should have failed");
    } catch (err) {
      // Should fail because either AlreadyInvited or conversation account already exists
      assert.ok(
        err.toString().includes("AlreadyInvited") ||
        err.toString().includes("already in use") ||
        err.toString().includes("custom program error: 0x0")
      );
    }
  });

  it("Can reject an invitation", async () => {
    const dave = Keypair.generate();

    // Setup Dave
    const airdrop = await provider.connection.requestAirdrop(
      dave.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    const [daveWalletDescriptor] = PublicKey.findProgramAddressSync(
      [Buffer.from("wallet_descriptor"), dave.publicKey.toBuffer(), WALLET_DESCRIPTOR_VERSION],
      program.programId
    );

    const [daveUserProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), dave.publicKey.toBuffer(), USER_PROFILE_VERSION],
      program.programId
    );

    await program.methods
      .register("Dave")
      .accounts({
        walletDescriptor: daveWalletDescriptor,
        userProfile: daveUserProfile,
        payer: dave.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([dave])
      .rpc();

    // Alice invites Dave
    const chatHash = getChatHash(alice.publicKey, dave.publicKey);
    const [conversation] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversation"), chatHash, CONVERSATION_VERSION],
      program.programId
    );

    await program.methods
      .invite(Array.from(chatHash))
      .accounts({
        payer: alice.publicKey,
        invitee: dave.publicKey,
        payerDescriptor: aliceWalletDescriptor,
        inviteeDescriptor: daveWalletDescriptor,
        conversation,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Dave rejects
    await program.methods
      .reject()
      .accounts({
        payer: dave.publicKey,
        peer: alice.publicKey,
        payerDescriptor: daveWalletDescriptor,
        peerDescriptor: aliceWalletDescriptor,
      })
      .signers([dave])
      .rpc();

    // Verify rejected state
    const daveDescriptor = await program.account.walletDescriptor.fetch(daveWalletDescriptor);
    const davePeer = daveDescriptor.peers.find(p => p.wallet.equals(alice.publicKey));
    assert.deepEqual(davePeer.state, { rejected: {} });
  });
});
