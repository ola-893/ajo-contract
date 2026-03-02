#[starknet::contract]
pub mod BTCCollateralAdapter {
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_btc_collateral_adapter::{
        IBTCCollateralAdapter, BTCCommitment, CommitmentStatus
    };
    use ajo_save::components::ownable::OwnableComponent;
    use ajo_save::components::pausable::{PausableComponent, IPausable};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        commitments: Map<u256, BTCCommitment>,
        member_commitments: Map<ContractAddress, u256>,
        next_commitment_id: u256,
        authorized_core: ContractAddress,
        op_cat_verifier: ContractAddress,

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        CommitmentRegistered: CommitmentRegistered,
        CommitmentVerified: CommitmentVerified,
        EnforcementStarted: EnforcementStarted,
        EnforcementConfirmed: EnforcementConfirmed,
        CommitmentReleased: CommitmentReleased,
        AuthorizedCoreUpdated: AuthorizedCoreUpdated,
        OpCatVerifierUpdated: OpCatVerifierUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CommitmentRegistered {
        #[key]
        pub commitment_id: u256,
        #[key]
        pub member: ContractAddress,
        pub ajo_id: u256,
        pub amount: u256,
        pub btc_script_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CommitmentVerified {
        #[key]
        pub commitment_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EnforcementStarted {
        #[key]
        pub commitment_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EnforcementConfirmed {
        #[key]
        pub commitment_id: u256,
        pub btc_tx_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CommitmentReleased {
        #[key]
        pub commitment_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AuthorizedCoreUpdated {
        pub core: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OpCatVerifierUpdated {
        pub verifier: ContractAddress,
    }

    pub mod Errors {
        pub const INVALID_MEMBER: felt252 = 'Member address is zero';
        pub const INVALID_AMOUNT: felt252 = 'Amount must be greater than 0';
        pub const INVALID_SCRIPT_HASH: felt252 = 'Invalid BTC script hash';
        pub const COMMITMENT_NOT_FOUND: felt252 = 'Commitment not found';
        pub const INVALID_STATUS: felt252 = 'Invalid commitment status';
        pub const UNAUTHORIZED_CORE: felt252 = 'Caller is not authorized core';
        pub const UNAUTHORIZED_VERIFIER: felt252 = 'Caller is not OP_CAT verifier';
        pub const INVALID_TX_HASH: felt252 = 'Invalid BTC tx hash';
        pub const ZERO_ADDRESS: felt252 = 'Address cannot be zero';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, owner: ContractAddress, op_cat_verifier: ContractAddress
    ) {
        self.ownable.initializer(owner);
        self.authorized_core.write(owner);
        self.op_cat_verifier.write(op_cat_verifier);
        self.next_commitment_id.write(0);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.authorized_core.read(), Errors::UNAUTHORIZED_CORE);
        }

        fn assert_only_verifier(self: @ContractState) {
            let caller = get_caller_address();
            let verifier = self.op_cat_verifier.read();
            let owner = self.ownable.owner();
            assert(caller == verifier || caller == owner, Errors::UNAUTHORIZED_VERIFIER);
        }
    }

    #[abi(embed_v0)]
    impl BTCCollateralAdapterImpl of IBTCCollateralAdapter<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), Errors::ZERO_ADDRESS);
            self.authorized_core.write(core);
            self.emit(AuthorizedCoreUpdated { core });
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

        fn register_commitment(
            ref self: ContractState,
            ajo_id: u256,
            member: ContractAddress,
            amount: u256,
            btc_script_hash: felt252,
            proof: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_core(@self);
            assert(!member.is_zero(), Errors::INVALID_MEMBER);
            assert(amount > 0, Errors::INVALID_AMOUNT);
            assert(btc_script_hash != 0, Errors::INVALID_SCRIPT_HASH);

            let commitment_id = self.next_commitment_id.read() + 1;
            self.next_commitment_id.write(commitment_id);

            let proof_reference = if proof.len() > 0 { *proof.at(0) } else { 0 };
            let commitment = BTCCommitment {
                commitment_id,
                member,
                ajo_id,
                amount,
                btc_script_hash,
                proof_reference,
                status: CommitmentStatus::Registered,
                registered_at: get_block_timestamp(),
                enforcement_tx_hash: 0,
            };

            self.commitments.write(commitment_id, commitment);
            self.member_commitments.write(member, commitment_id);
            self.emit(CommitmentRegistered {
                commitment_id,
                member,
                ajo_id,
                amount,
                btc_script_hash,
            });
            commitment_id
        }

        fn verify_commitment(
            ref self: ContractState, commitment_id: u256, verification_proof: Span<felt252>
        ) {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_verifier(@self);
            assert(verification_proof.len() > 0, 'Verification proof required');

            let mut commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);
            assert(commitment.status == CommitmentStatus::Registered, Errors::INVALID_STATUS);

            commitment.status = CommitmentStatus::Verified;
            self.commitments.write(commitment_id, commitment);
            self.emit(CommitmentVerified { commitment_id });
        }

        fn start_enforcement(
            ref self: ContractState, commitment_id: u256, default_proof: Span<felt252>
        ) {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_core(@self);
            assert(default_proof.len() > 0, 'Default proof required');

            let mut commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);
            assert(commitment.status == CommitmentStatus::Verified, Errors::INVALID_STATUS);

            commitment.status = CommitmentStatus::EnforcementStarted;
            self.commitments.write(commitment_id, commitment);
            self.emit(EnforcementStarted { commitment_id });
        }

        fn confirm_enforcement(
            ref self: ContractState, commitment_id: u256, btc_tx_hash: felt252
        ) {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_verifier(@self);
            assert(btc_tx_hash != 0, Errors::INVALID_TX_HASH);

            let mut commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);
            assert(
                commitment.status == CommitmentStatus::EnforcementStarted,
                Errors::INVALID_STATUS
            );

            commitment.status = CommitmentStatus::EnforcementConfirmed;
            commitment.enforcement_tx_hash = btc_tx_hash;
            self.commitments.write(commitment_id, commitment);
            self.emit(EnforcementConfirmed { commitment_id, btc_tx_hash });
        }

        fn release_commitment(ref self: ContractState, commitment_id: u256) {
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            let owner = self.ownable.owner();
            let core = self.authorized_core.read();
            assert(caller == owner || caller == core, Errors::UNAUTHORIZED_CORE);

            let mut commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);

            commitment.status = CommitmentStatus::Released;
            self.commitments.write(commitment_id, commitment);
            self.emit(CommitmentReleased { commitment_id });
        }

        fn get_commitment(self: @ContractState, commitment_id: u256) -> BTCCommitment {
            let commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);
            commitment
        }

        fn get_member_commitment(self: @ContractState, member: ContractAddress) -> u256 {
            self.member_commitments.read(member)
        }

        fn get_commitment_status(self: @ContractState, commitment_id: u256) -> CommitmentStatus {
            let commitment = self.commitments.read(commitment_id);
            assert(commitment.commitment_id != 0, Errors::COMMITMENT_NOT_FOUND);
            commitment.status
        }

        fn set_op_cat_verifier(ref self: ContractState, verifier: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!verifier.is_zero(), Errors::ZERO_ADDRESS);
            self.op_cat_verifier.write(verifier);
            self.emit(OpCatVerifierUpdated { verifier });
        }

        fn get_op_cat_verifier(self: @ContractState) -> ContractAddress {
            self.op_cat_verifier.read()
        }

        fn emergency_pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }
    }
}
