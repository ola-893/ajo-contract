#[starknet::contract]
pub mod BridgeAdapter {
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_bridge_adapter::{
        IBridgeAdapter, DepositRequest, WithdrawalRequest, BridgeRequestStatus
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
        // Request tracking
        deposit_requests: Map<u256, DepositRequest>,
        withdrawal_requests: Map<u256, WithdrawalRequest>,
        request_statuses: Map<u256, BridgeRequestStatus>,
        request_exists: Map<u256, bool>,
        next_request_id: u256,

        // Replay protection
        used_btc_tx_hashes: Map<felt252, bool>,
        member_nonces: Map<ContractAddress, u256>,

        // Configuration
        bridge_relayer: ContractAddress,
        authorized_core: ContractAddress,

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DepositRegistered: DepositRegistered,
        DepositFinalized: DepositFinalized,
        WithdrawalRequested: WithdrawalRequested,
        WithdrawalFinalized: WithdrawalFinalized,
        WithdrawalCancelled: WithdrawalCancelled,
        BridgeRelayerUpdated: BridgeRelayerUpdated,
        AuthorizedCoreUpdated: AuthorizedCoreUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositRegistered {
        #[key]
        pub request_id: u256,
        #[key]
        pub member: ContractAddress,
        pub ajo_id: u256,
        pub amount: u256,
        pub btc_tx_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositFinalized {
        #[key]
        pub request_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalRequested {
        #[key]
        pub request_id: u256,
        #[key]
        pub member: ContractAddress,
        pub ajo_id: u256,
        pub amount: u256,
        pub btc_address: felt252,
        pub nonce: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalFinalized {
        #[key]
        pub request_id: u256,
        pub btc_tx_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalCancelled {
        #[key]
        pub request_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BridgeRelayerUpdated {
        pub relayer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AuthorizedCoreUpdated {
        pub core: ContractAddress,
    }

    pub mod Errors {
        pub const INVALID_AMOUNT: felt252 = 'Amount must be greater than 0';
        pub const INVALID_MEMBER: felt252 = 'Member address is zero';
        pub const INVALID_BTC_ADDRESS: felt252 = 'Invalid BTC address';
        pub const INVALID_BTC_TX_HASH: felt252 = 'Invalid BTC tx hash';
        pub const INVALID_PROOF: felt252 = 'Invalid deposit proof';
        pub const REQUEST_NOT_FOUND: felt252 = 'Request not found';
        pub const REQUEST_NOT_PENDING: felt252 = 'Request is not pending';
        pub const DUPLICATE_BTC_TX_HASH: felt252 = 'Duplicate BTC tx hash';
        pub const UNAUTHORIZED_RELAYER: felt252 = 'Caller is not bridge relayer';
        pub const UNAUTHORIZED_CORE: felt252 = 'Caller is not authorized core';
        pub const UNAUTHORIZED_CANCELLER: felt252 = 'Not authorized to cancel';
        pub const ZERO_ADDRESS: felt252 = 'Address cannot be zero';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, relayer: ContractAddress) {
        self.ownable.initializer(owner);
        assert(!relayer.is_zero(), Errors::ZERO_ADDRESS);
        self.bridge_relayer.write(relayer);
        self.authorized_core.write(owner);
        self.next_request_id.write(0);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_relayer(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.bridge_relayer.read(), Errors::UNAUTHORIZED_RELAYER);
        }

        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.authorized_core.read(), Errors::UNAUTHORIZED_CORE);
        }
    }

    #[abi(embed_v0)]
    impl BridgeAdapterImpl of IBridgeAdapter<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), Errors::ZERO_ADDRESS);
            self.authorized_core.write(core);
            self.emit(AuthorizedCoreUpdated { core });
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

        fn register_deposit(
            ref self: ContractState,
            ajo_id: u256,
            member: ContractAddress,
            amount: u256,
            btc_tx_hash: felt252,
            proof: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_core(@self);
            assert(!member.is_zero(), Errors::INVALID_MEMBER);
            assert(amount > 0, Errors::INVALID_AMOUNT);
            assert(btc_tx_hash != 0, Errors::INVALID_BTC_TX_HASH);
            assert(proof.len() > 0, Errors::INVALID_PROOF);
            assert(!self.used_btc_tx_hashes.read(btc_tx_hash), Errors::DUPLICATE_BTC_TX_HASH);

            let request_id = self.next_request_id.read() + 1;
            self.next_request_id.write(request_id);

            let request = DepositRequest {
                request_id,
                ajo_id,
                member,
                amount,
                btc_tx_hash,
                status: BridgeRequestStatus::Pending,
                timestamp: get_block_timestamp(),
            };

            self.deposit_requests.write(request_id, request);
            self.request_statuses.write(request_id, BridgeRequestStatus::Pending);
            self.request_exists.write(request_id, true);
            self.used_btc_tx_hashes.write(btc_tx_hash, true);

            self.emit(DepositRegistered { request_id, member, ajo_id, amount, btc_tx_hash });
            request_id
        }

        fn finalize_deposit(ref self: ContractState, request_id: u256) {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_relayer(@self);

            let mut request = self.deposit_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            assert(request.status == BridgeRequestStatus::Pending, Errors::REQUEST_NOT_PENDING);

            request.status = BridgeRequestStatus::Finalized;
            self.deposit_requests.write(request_id, request);
            self.request_statuses.write(request_id, BridgeRequestStatus::Finalized);
            self.emit(DepositFinalized { request_id });
        }

        fn request_withdrawal(
            ref self: ContractState, ajo_id: u256, amount: u256, btc_address: felt252
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(amount > 0, Errors::INVALID_AMOUNT);
            assert(btc_address != 0, Errors::INVALID_BTC_ADDRESS);

            let caller = get_caller_address();
            let nonce = self.member_nonces.read(caller) + 1;
            self.member_nonces.write(caller, nonce);

            let request_id = self.next_request_id.read() + 1;
            self.next_request_id.write(request_id);

            let request = WithdrawalRequest {
                request_id,
                ajo_id,
                member: caller,
                amount,
                btc_address,
                nonce,
                status: BridgeRequestStatus::Pending,
                timestamp: get_block_timestamp(),
                btc_tx_hash: 0,
            };

            self.withdrawal_requests.write(request_id, request);
            self.request_statuses.write(request_id, BridgeRequestStatus::Pending);
            self.request_exists.write(request_id, true);

            self.emit(WithdrawalRequested { request_id, member: caller, ajo_id, amount, btc_address, nonce });
            request_id
        }

        fn finalize_withdrawal(
            ref self: ContractState, request_id: u256, btc_tx_hash: felt252
        ) {
            self.pausable.assert_not_paused();
            InternalImpl::assert_only_relayer(@self);
            assert(btc_tx_hash != 0, Errors::INVALID_BTC_TX_HASH);
            assert(!self.used_btc_tx_hashes.read(btc_tx_hash), Errors::DUPLICATE_BTC_TX_HASH);

            let mut request = self.withdrawal_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            assert(request.status == BridgeRequestStatus::Pending, Errors::REQUEST_NOT_PENDING);

            request.status = BridgeRequestStatus::Finalized;
            request.btc_tx_hash = btc_tx_hash;
            self.withdrawal_requests.write(request_id, request);
            self.request_statuses.write(request_id, BridgeRequestStatus::Finalized);
            self.used_btc_tx_hashes.write(btc_tx_hash, true);

            self.emit(WithdrawalFinalized { request_id, btc_tx_hash });
        }

        fn cancel_withdrawal(ref self: ContractState, request_id: u256) {
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            let owner = self.ownable.owner();
            let mut request = self.withdrawal_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            assert(request.status == BridgeRequestStatus::Pending, Errors::REQUEST_NOT_PENDING);
            assert(caller == owner || caller == request.member, Errors::UNAUTHORIZED_CANCELLER);

            request.status = BridgeRequestStatus::Cancelled;
            self.withdrawal_requests.write(request_id, request);
            self.request_statuses.write(request_id, BridgeRequestStatus::Cancelled);

            self.emit(WithdrawalCancelled { request_id });
        }

        fn get_deposit_request(self: @ContractState, request_id: u256) -> DepositRequest {
            let request = self.deposit_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            request
        }

        fn get_withdrawal_request(self: @ContractState, request_id: u256) -> WithdrawalRequest {
            let request = self.withdrawal_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            request
        }

        fn get_request_status(self: @ContractState, request_id: u256) -> BridgeRequestStatus {
            assert(self.request_exists.read(request_id), Errors::REQUEST_NOT_FOUND);
            self.request_statuses.read(request_id)
        }

        fn set_bridge_relayer(ref self: ContractState, relayer: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!relayer.is_zero(), Errors::ZERO_ADDRESS);
            self.bridge_relayer.write(relayer);
            self.emit(BridgeRelayerUpdated { relayer });
        }

        fn get_bridge_relayer(self: @ContractState) -> ContractAddress {
            self.bridge_relayer.read()
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
