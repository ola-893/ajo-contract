#[starknet::contract]
pub mod SwapRouter {
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_swap_router::{ISwapRouter, SwapRequest, SwapStatus};
    use ajo_save::components::ownable::OwnableComponent;
    use ajo_save::components::reentrancy_guard::ReentrancyGuardComponent;

    #[starknet::interface]
    pub trait IERC20<TContractState> {
        fn transfer(
            ref self: TContractState, recipient: ContractAddress, amount: u256
        ) -> bool;
        fn transfer_from(
            ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256
        ) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    }

    #[starknet::interface]
    pub trait IDexRouter<TContractState> {
        fn get_quote(
            self: @TContractState, source_token: ContractAddress, dest_token: ContractAddress, amount: u256
        ) -> u256;
        fn execute_swap(
            ref self: TContractState,
            source_token: ContractAddress,
            dest_token: ContractAddress,
            source_amount: u256,
            min_dest_amount: u256,
            recipient: ContractAddress,
        ) -> u256;
    }

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        swap_requests: Map<u256, SwapRequest>,
        next_request_id: u256,
        dex_router: ContractAddress,
        authorized_executor: ContractAddress,

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SwapQuoted: SwapQuoted,
        SwapExecuted: SwapExecuted,
        SwapCancelled: SwapCancelled,
        SwapFailed: SwapFailed,
        DexRouterUpdated: DexRouterUpdated,
        AuthorizedExecutorUpdated: AuthorizedExecutorUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapQuoted {
        pub source_token: ContractAddress,
        pub dest_token: ContractAddress,
        pub source_amount: u256,
        pub quoted_dest_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapExecuted {
        #[key]
        pub request_id: u256,
        #[key]
        pub recipient: ContractAddress,
        pub source_amount: u256,
        pub dest_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapCancelled {
        #[key]
        pub request_id: u256,
        pub reason: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapFailed {
        #[key]
        pub request_id: u256,
        pub reason: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DexRouterUpdated {
        pub dex_router: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AuthorizedExecutorUpdated {
        pub authorized_executor: ContractAddress,
    }

    pub mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Address cannot be zero';
        pub const INVALID_AMOUNT: felt252 = 'Amount must be greater than 0';
        pub const INVALID_DEADLINE: felt252 = 'Swap deadline has passed';
        pub const REQUEST_NOT_FOUND: felt252 = 'Swap request not found';
        pub const REQUEST_NOT_PENDING: felt252 = 'Swap request is not pending';
        pub const UNAUTHORIZED: felt252 = 'Caller is not authorized';
        pub const MIN_OUTPUT_NOT_MET: felt252 = 'Minimum output not met';
        pub const TOKEN_TRANSFER_FAILED: felt252 = 'Token transfer failed';
        pub const APPROVAL_FAILED: felt252 = 'Token approval failed';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.next_request_id.write(0);
        self.dex_router.write(Zero::zero());
        self.authorized_executor.write(owner);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_executor(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.authorized_executor.read(), Errors::UNAUTHORIZED);
        }
    }

    #[abi(embed_v0)]
    impl SwapRouterImpl of ISwapRouter<ContractState> {
        fn set_authorized_executor(ref self: ContractState, executor: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!executor.is_zero(), Errors::ZERO_ADDRESS);
            self.authorized_executor.write(executor);
            self.emit(AuthorizedExecutorUpdated { authorized_executor: executor });
        }

        fn get_authorized_executor(self: @ContractState) -> ContractAddress {
            self.authorized_executor.read()
        }

        fn get_quote(
            self: @ContractState, source_token: ContractAddress, dest_token: ContractAddress, amount: u256
        ) -> u256 {
            assert(amount > 0, Errors::INVALID_AMOUNT);

            let quoted = if source_token == dest_token {
                amount
            } else {
                let dex_router = self.dex_router.read();
                if dex_router.is_zero() {
                    0
                } else {
                    let dex = IDexRouterDispatcher { contract_address: dex_router };
                    dex.get_quote(source_token, dest_token, amount)
                }
            };

            quoted
        }

        fn execute_swap(
            ref self: ContractState,
            ajo_id: u256,
            recipient: ContractAddress,
            source_token: ContractAddress,
            dest_token: ContractAddress,
            source_amount: u256,
            min_dest_amount: u256,
            deadline: u64,
        ) -> u256 {
            InternalImpl::assert_only_executor(@self);
            self.reentrancy_guard.start();
            assert(source_amount > 0, Errors::INVALID_AMOUNT);
            assert(!recipient.is_zero(), Errors::ZERO_ADDRESS);
            assert(deadline >= get_block_timestamp(), Errors::INVALID_DEADLINE);

            let request_id = self.next_request_id.read() + 1;
            self.next_request_id.write(request_id);
            let requester = get_caller_address();

            let mut request = SwapRequest {
                request_id,
                ajo_id,
                requester,
                recipient,
                source_token,
                dest_token,
                source_amount,
                min_dest_amount,
                deadline,
                status: SwapStatus::Pending,
                actual_dest_amount: 0,
                created_at: get_block_timestamp(),
            };
            self.swap_requests.write(request_id, request);

            let src = IERC20Dispatcher { contract_address: source_token };
            let transfer_ok = src.transfer_from(requester, get_contract_address(), source_amount);
            assert(transfer_ok, Errors::TOKEN_TRANSFER_FAILED);

            let actual_dest_amount = if source_token == dest_token {
                let payout_ok = src.transfer(recipient, source_amount);
                assert(payout_ok, Errors::TOKEN_TRANSFER_FAILED);
                source_amount
            } else {
                let dex_router = self.dex_router.read();
                assert(!dex_router.is_zero(), 'DEX router not configured');

                let approved = src.approve(dex_router, source_amount);
                assert(approved, Errors::APPROVAL_FAILED);

                let dex = IDexRouterDispatcher { contract_address: dex_router };
                dex.execute_swap(
                    source_token, dest_token, source_amount, min_dest_amount, recipient
                )
            };

            if actual_dest_amount < min_dest_amount {
                request.status = SwapStatus::Failed;
                request.actual_dest_amount = actual_dest_amount;
                self.swap_requests.write(request_id, request);
                self.emit(SwapFailed { request_id, reason: Errors::MIN_OUTPUT_NOT_MET });
                self.reentrancy_guard.end();
                return request_id;
            }

            request.status = SwapStatus::Executed;
            request.actual_dest_amount = actual_dest_amount;
            self.swap_requests.write(request_id, request);
            self.emit(SwapExecuted { request_id, recipient, source_amount, dest_amount: actual_dest_amount });

            self.reentrancy_guard.end();
            request_id
        }

        fn cancel_swap(ref self: ContractState, request_id: u256) {
            let caller = get_caller_address();
            let owner = self.ownable.owner();
            let mut request = self.swap_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            assert(request.status == SwapStatus::Pending, Errors::REQUEST_NOT_PENDING);
            assert(caller == owner || caller == request.requester, Errors::UNAUTHORIZED);

            request.status = SwapStatus::Cancelled;
            self.swap_requests.write(request_id, request);
            self.emit(SwapCancelled { request_id, reason: 'Cancelled by caller' });
        }

        fn get_swap_request(self: @ContractState, request_id: u256) -> SwapRequest {
            let request = self.swap_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            request
        }

        fn get_swap_status(self: @ContractState, request_id: u256) -> SwapStatus {
            let request = self.swap_requests.read(request_id);
            assert(request.request_id != 0, Errors::REQUEST_NOT_FOUND);
            request.status
        }

        fn set_dex_router(ref self: ContractState, router: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!router.is_zero(), Errors::ZERO_ADDRESS);
            self.dex_router.write(router);
            self.emit(DexRouterUpdated { dex_router: router });
        }

        fn get_dex_router(self: @ContractState) -> ContractAddress {
            self.dex_router.read()
        }
    }
}
