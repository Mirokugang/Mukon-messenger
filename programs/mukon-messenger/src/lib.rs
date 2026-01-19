use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};
use arcium_anchor::prelude::*;

declare_id!("89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr");

#[error_code]
pub enum ErrorCode {
    #[msg("Already invited")]
    AlreadyInvited,
    #[msg("Not invited")]
    NotInvited,
    #[msg("Not requested")]
    NotRequested,
    #[msg("Invalid hash")]
    InvalidHash,
    #[msg("Display name too long")]
    DisplayNameTooLong,
}

// Deterministic hash function for chat PDAs
fn get_chat_hash(a: Pubkey, b: Pubkey) -> [u8; 32] {
    let mut c: [u8; 64] = [0; 64];

    for i in 0..32 {
        if a.to_bytes()[i] == b.to_bytes()[i] {
            continue;
        }
        if a.to_bytes()[i] < b.to_bytes()[i] {
            c[0..32].copy_from_slice(&a.to_bytes());
            c[32..64].copy_from_slice(&b.to_bytes());
        } else {
            c[0..32].copy_from_slice(&b.to_bytes());
            c[32..64].copy_from_slice(&a.to_bytes());
        }
        break;
    }

    let mut hasher = Sha256::new();
    hasher.update(&c);
    hasher.finalize().into()
}

#[arcium_program]
pub mod mukon_messenger {
    use super::*;

    pub fn register(ctx: Context<Register>, display_name: String, encryption_public_key: [u8; 32]) -> Result<()> {
        let wallet_descriptor = &mut ctx.accounts.wallet_descriptor;
        let user_profile = &mut ctx.accounts.user_profile;
        let payer = &ctx.accounts.payer;

        require!(display_name.len() <= 32, ErrorCode::DisplayNameTooLong);

        wallet_descriptor.owner = payer.key();
        wallet_descriptor.peers = vec![];

        user_profile.owner = payer.key();
        user_profile.display_name = display_name.clone();
        user_profile.avatar_url = String::new();
        user_profile.encryption_public_key = encryption_public_key;

        msg!("Register: {:?} with display name: {}", payer.key(), display_name);

        Ok(())
    }

    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        display_name: Option<String>,
        avatar_url: Option<String>
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;

        if let Some(name) = display_name {
            require!(name.len() <= 32, ErrorCode::DisplayNameTooLong);
            user_profile.display_name = name;
        }

        if let Some(url) = avatar_url {
            user_profile.avatar_url = url;
        }

        msg!("Profile updated: {:?}", ctx.accounts.payer.key());

        Ok(())
    }

    pub fn invite(ctx: Context<Invite>, _hash: [u8; 32]) -> Result<()> {
        let inviter = &ctx.accounts.payer;
        let invitee = &ctx.accounts.invitee;
        let inviter_descriptor = &mut ctx.accounts.payer_descriptor;
        let invitee_descriptor = &mut ctx.accounts.invitee_descriptor;

        require!(
            inviter_descriptor.peers.iter().all(|p| p.wallet != invitee.key()),
            ErrorCode::AlreadyInvited
        );
        require!(
            invitee_descriptor.peers.iter().all(|p| p.wallet != inviter.key()),
            ErrorCode::AlreadyInvited
        );

        let hash = get_chat_hash(inviter.key(), invitee.key());
        require!(hash == _hash, ErrorCode::InvalidHash);

        inviter_descriptor.peers.push(Peer {
            wallet: invitee.key(),
            state: PeerState::Invited,
        });
        invitee_descriptor.peers.push(Peer {
            wallet: inviter.key(),
            state: PeerState::Requested,
        });

        let conversation = &mut ctx.accounts.conversation;
        conversation.participants = [inviter.key(), invitee.key()];
        conversation.created_at = Clock::get()?.unix_timestamp;

        msg!("Invite: sender={:?}, target={:?}, chat={:?}",
             inviter.key(), invitee.key(), hash);

        Ok(())
    }

    pub fn accept(ctx: Context<Accept>) -> Result<()> {
        let me = &ctx.accounts.payer;
        let peer = &ctx.accounts.peer;
        let me_descriptor = &mut ctx.accounts.payer_descriptor;
        let peer_descriptor = &mut ctx.accounts.peer_descriptor;

        require!(
            me_descriptor.peers.iter()
                .any(|p| p.wallet == peer.key() && p.state == PeerState::Requested),
            ErrorCode::NotRequested
        );
        require!(
            peer_descriptor.peers.iter()
                .any(|p| p.wallet == me.key() && p.state == PeerState::Invited),
            ErrorCode::NotInvited
        );

        for p in me_descriptor.peers.iter_mut() {
            if p.wallet == peer.key() {
                p.state = PeerState::Accepted;
                break;
            }
        }
        for p in peer_descriptor.peers.iter_mut() {
            if p.wallet == me.key() {
                p.state = PeerState::Accepted;
                break;
            }
        }

        msg!("Accept: accepter={:?}, inviter={:?}, chat={:?}",
             me.key(), peer.key(), get_chat_hash(me.key(), peer.key()));

        Ok(())
    }

    pub fn reject(ctx: Context<Reject>) -> Result<()> {
        let me = &ctx.accounts.payer;
        let peer = &ctx.accounts.peer;
        let me_descriptor = &mut ctx.accounts.payer_descriptor;
        let peer_descriptor = &mut ctx.accounts.peer_descriptor;

        require!(
            me_descriptor.peers.iter()
                .any(|p| p.wallet == peer.key() && p.state == PeerState::Requested),
            ErrorCode::NotRequested
        );
        require!(
            peer_descriptor.peers.iter()
                .any(|p| p.wallet == me.key() && p.state == PeerState::Invited),
            ErrorCode::NotInvited
        );

        for p in me_descriptor.peers.iter_mut() {
            if p.wallet == peer.key() {
                p.state = PeerState::Rejected;
                break;
            }
        }
        for p in peer_descriptor.peers.iter_mut() {
            if p.wallet == me.key() {
                p.state = PeerState::Rejected;
                break;
            }
        }

        msg!("Reject: rejecter={:?}, inviter={:?}",
             me.key(), peer.key());

        Ok(())
    }
}

// Account Structures

const WALLET_DESCRIPTOR_VERSION: [u8; 1] = [1];
const USER_PROFILE_VERSION: [u8; 1] = [1];
const CONVERSATION_VERSION: [u8; 1] = [1];

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PeerState {
    Invited = 0,
    Requested = 1,
    Accepted = 2,
    Rejected = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Peer {
    pub wallet: Pubkey,
    pub state: PeerState,
}

#[account]
pub struct WalletDescriptor {
    pub owner: Pubkey,
    pub peers: Vec<Peer>,
}

#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub display_name: String,
    pub avatar_url: String,
    pub encryption_public_key: [u8; 32],
}

#[account]
pub struct Conversation {
    pub participants: [Pubkey; 2],
    pub created_at: i64,
}

// Context Structures

#[derive(Accounts)]
#[instruction(display_name: String, encryption_public_key: [u8; 32])]
pub struct Register<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 4,
        seeds = [b"wallet_descriptor", payer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump
    )]
    pub wallet_descriptor: Account<'info, WalletDescriptor>,
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + (4 + 32) + (4 + 128) + 32,
        seeds = [b"user_profile", payer.key().as_ref(), USER_PROFILE_VERSION.as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", payer.key().as_ref(), USER_PROFILE_VERSION.as_ref()],
        bump,
        realloc = 8 + 32 + (4 + 32) + (4 + 128),
        realloc::payer = payer,
        realloc::zero = true
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_hash: [u8; 32])]
pub struct Invite<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: invitee is a public key
    pub invitee: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", payer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump,
        realloc = 8 + 32 + 4 + (payer_descriptor.peers.len() + 1) * (32 + 1),
        realloc::payer = payer,
        realloc::zero = true
    )]
    pub payer_descriptor: Account<'info, WalletDescriptor>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", invitee.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump,
        realloc = 8 + 32 + 4 + (invitee_descriptor.peers.len() + 1) * (32 + 1),
        realloc::payer = payer,
        realloc::zero = true
    )]
    pub invitee_descriptor: Account<'info, WalletDescriptor>,
    #[account(
        init,
        payer = payer,
        space = 8 + 64 + 8,
        seeds = [b"conversation", _hash.as_ref(), CONVERSATION_VERSION.as_ref()],
        bump
    )]
    pub conversation: Account<'info, Conversation>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Accept<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: peer is a public key
    pub peer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", payer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump
    )]
    pub payer_descriptor: Account<'info, WalletDescriptor>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", peer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump
    )]
    pub peer_descriptor: Account<'info, WalletDescriptor>,
}

#[derive(Accounts)]
pub struct Reject<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: peer is a public key
    pub peer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", payer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump
    )]
    pub payer_descriptor: Account<'info, WalletDescriptor>,
    #[account(
        mut,
        seeds = [b"wallet_descriptor", peer.key().as_ref(), WALLET_DESCRIPTOR_VERSION.as_ref()],
        bump
    )]
    pub peer_descriptor: Account<'info, WalletDescriptor>,
}
