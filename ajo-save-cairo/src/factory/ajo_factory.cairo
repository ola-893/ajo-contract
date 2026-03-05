#[starknet::contract]
pub mod AjoFactory {
    use starknet::{
        ContractAddress, ClassHash, get_caller_address, get_block_timestamp, get_contract_address,
        syscalls::deploy_syscall, SyscallResultTrait
    };
    use starknet::storage::{
        Map, Vec, VecTrait, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, MutableVecTrait
    };
    use core::num::traits::Zero;
    use ajo_save::interfaces::types::{AjoConfig, AjoInfo, PaymentToken, CollateralMode, Constants};
    use ajo_save::interfaces::i_ajo_factory::IAjoFactory;
    use ajo_save::interfaces::i_ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
    use ajo_save::interfaces::i_ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
    use ajo_save::interfaces::i_ajo_collateral::{
        IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait
    };
    use ajo_save::interfaces::i_ajo_payments::{
        IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait
    };
    use ajo_save::interfaces::i_ajo_governance::{
        IAjoGovernanceDispatcher, IAjoGovernanceDispatcherTrait
    };
    use ajo_save::interfaces::i_ajo_schedule::{IAjoScheduleDispatcher, IAjoScheduleDispatcherTrait};
    use ajo_save::components::ownable::{
        OwnableComponent, IOwnableDispatcher, IOwnableDispatcherTrait
    };
    use ajo_save::components::pausable::PausableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;

    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Component storage
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        // Class hashes for deployment
        core_class_hash: ClassHash,
        members_class_hash: ClassHash,
        collateral_class_hash: ClassHash,
        payments_class_hash: ClassHash,
        governance_class_hash: ClassHash,
        schedule_class_hash: ClassHash,
        usdc_token_address: ContractAddress,
        btc_token_address: ContractAddress,
        // Ajo registry
        ajos: Map<u256, AjoInfo>,
        user_ajos: Map<ContractAddress, Vec<u256>>,
        total_ajos: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        AjoCreated: AjoCreated,
        CoreDeployed: CoreDeployed,
        MembersDeployed: MembersDeployed,
        CollateralDeployed: CollateralDeployed,
        PaymentsDeployed: PaymentsDeployed,
        GovernanceDeployed: GovernanceDeployed,
        ScheduleDeployed: ScheduleDeployed,
        AjoInitialized: AjoInitialized,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AjoCreated {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub creator: ContractAddress,
        pub name: felt252,
        pub monthly_contribution: u256,
        pub total_participants: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoreDeployed {
        #[key]
        pub ajo_id: u256,
        pub core_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MembersDeployed {
        #[key]
        pub ajo_id: u256,
        pub members_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralDeployed {
        #[key]
        pub ajo_id: u256,
        pub collateral_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentsDeployed {
        #[key]
        pub ajo_id: u256,
        pub payments_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct GovernanceDeployed {
        #[key]
        pub ajo_id: u256,
        pub governance_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ScheduleDeployed {
        #[key]
        pub ajo_id: u256,
        pub schedule_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AjoInitialized {
        #[key]
        pub ajo_id: u256,
        pub core_address: ContractAddress,
    }

    pub mod Errors {
        pub const INVALID_PARTICIPANTS: felt252 = 'Invalid participant count';
        pub const INVALID_CONTRIBUTION: felt252 = 'Invalid contribution amount';
        pub const INVALID_CYCLE_DURATION: felt252 = 'Invalid cycle duration';
        pub const AJO_NOT_FOUND: felt252 = 'Ajo not found';
        pub const ALREADY_INITIALIZED: felt252 = 'Ajo already initialized';
        pub const CLASS_HASH_NOT_SET: felt252 = 'Class hash not set';
        pub const UNAUTHORIZED_DEPLOYER: felt252 = 'Caller is not ajo creator';
        pub const PHASE_ALREADY_DEPLOYED: felt252 = 'Phase already deployed';
    }

    fn assert_valid_create_inputs(
        total_participants: u256, monthly_contribution: u256, cycle_duration: u64
    ) {
        assert(
            total_participants >= Constants::MIN_PARTICIPANTS
                && total_participants <= Constants::MAX_PARTICIPANTS,
            Errors::INVALID_PARTICIPANTS
        );
        assert(monthly_contribution > 0, Errors::INVALID_CONTRIBUTION);
        assert(
            cycle_duration >= Constants::MIN_CYCLE_DURATION
                && cycle_duration <= Constants::MAX_CYCLE_DURATION,
            Errors::INVALID_CYCLE_DURATION
        );
    }

    fn assert_creator(self: @ContractState, ajo_id: u256) {
        let ajo_info = self.ajos.read(ajo_id);
        assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);
        let caller = get_caller_address();
        assert(caller == ajo_info.config.creator, Errors::UNAUTHORIZED_DEPLOYER);
    }

    fn create_ajo_internal(
        ref self: ContractState,
        name: felt252,
        monthly_contribution: u256,
        total_participants: u256,
        cycle_duration: u64,
        payment_token: PaymentToken,
    ) -> u256 {
        assert_valid_create_inputs(total_participants, monthly_contribution, cycle_duration);

        let caller = get_caller_address();
        let ajo_id = self.total_ajos.read() + 1;

        let config = AjoConfig {
            name,
            monthly_contribution,
            total_participants,
            cycle_duration,
            payment_token,
            collateral_mode: CollateralMode::L2Escrow,
            creator: caller,
        };

        let ajo_info = AjoInfo {
            id: ajo_id,
            config,
            core_address: Zero::zero(),
            members_address: Zero::zero(),
            collateral_address: Zero::zero(),
            payments_address: Zero::zero(),
            governance_address: Zero::zero(),
            schedule_address: Zero::zero(),
            is_initialized: false,
            created_at: get_block_timestamp(),
        };

        self.ajos.write(ajo_id, ajo_info);
        let user_vec = self.user_ajos.entry(caller);
        user_vec.append().write(ajo_id);
        self.total_ajos.write(ajo_id);

        self
            .emit(
                AjoCreated {
                    ajo_id, creator: caller, name, monthly_contribution, total_participants
                }
            );

        ajo_id
    }

    fn finalize_ajo_if_ready(ref self: ContractState, ref ajo_info: AjoInfo) {
        if !ajo_info.is_initialized
            && ajo_info.core_address.is_non_zero()
            && ajo_info.members_address.is_non_zero()
            && ajo_info.collateral_address.is_non_zero()
            && ajo_info.payments_address.is_non_zero()
            && ajo_info.governance_address.is_non_zero()
            && ajo_info.schedule_address.is_non_zero() {
            let core = IAjoCoreDispatcher { contract_address: ajo_info.core_address };
            core.initialize(
                ajo_info.config,
                ajo_info.members_address,
                ajo_info.collateral_address,
                ajo_info.payments_address,
                ajo_info.governance_address,
                ajo_info.schedule_address
            );

            let (token_address, token_decimals): (ContractAddress, u8) = match ajo_info.config
                .payment_token {
                PaymentToken::USDC => (self.usdc_token_address.read(), 6_u8),
                PaymentToken::BTC => (self.btc_token_address.read(), 8_u8),
            };
            assert(token_address.is_non_zero(), 'Token address not configured');
            core.set_payment_token_address(token_address, token_decimals);

            let members_dispatcher = IAjoMembersDispatcher { contract_address: ajo_info.members_address };
            members_dispatcher.set_authorized_core(ajo_info.core_address);

            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: ajo_info.collateral_address
            };
            collateral_dispatcher.set_authorized_core(ajo_info.core_address);

            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: ajo_info.payments_address
            };
            payments_dispatcher.set_authorized_core(ajo_info.core_address);

            let governance_dispatcher = IAjoGovernanceDispatcher {
                contract_address: ajo_info.governance_address
            };
            governance_dispatcher.set_authorized_core(ajo_info.core_address);

            let schedule_dispatcher = IAjoScheduleDispatcher {
                contract_address: ajo_info.schedule_address
            };
            schedule_dispatcher.set_authorized_core(ajo_info.core_address);

            let members_ownable = IOwnableDispatcher { contract_address: ajo_info.members_address };
            members_ownable.transfer_ownership(ajo_info.core_address);

            let collateral_ownable = IOwnableDispatcher {
                contract_address: ajo_info.collateral_address
            };
            collateral_ownable.transfer_ownership(ajo_info.core_address);

            let payments_ownable = IOwnableDispatcher { contract_address: ajo_info.payments_address };
            payments_ownable.transfer_ownership(ajo_info.core_address);

            let governance_ownable = IOwnableDispatcher {
                contract_address: ajo_info.governance_address
            };
            governance_ownable.transfer_ownership(ajo_info.core_address);

            let schedule_ownable = IOwnableDispatcher { contract_address: ajo_info.schedule_address };
            schedule_ownable.transfer_ownership(ajo_info.core_address);

            ajo_info.is_initialized = true;
            self.emit(AjoInitialized { ajo_id: ajo_info.id, core_address: ajo_info.core_address });
        }
    }

    fn deploy_members_internal(ref self: ContractState, ajo_id: u256) -> ContractAddress {
        let mut ajo_info = self.ajos.read(ajo_id);
        assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);
        assert(!ajo_info.members_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);

        let class_hash = self.members_class_hash.read();
        assert(class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

        let salt: felt252 = (ajo_id + 1000).try_into().unwrap();
        let mut calldata = ArrayTrait::new();
        // constructor(owner, total_participants)
        get_contract_address().serialize(ref calldata);
        ajo_info.config.total_participants.serialize(ref calldata);

        let (members_address, _) = deploy_syscall(class_hash, salt, calldata.span(), false)
            .unwrap_syscall();

        ajo_info.members_address = members_address;
        self.ajos.write(ajo_id, ajo_info);

        self.emit(MembersDeployed { ajo_id, members_address });

        members_address
    }

    fn deploy_collateral_and_payments_internal(
        ref self: ContractState, ajo_id: u256
    ) -> (ContractAddress, ContractAddress) {
        let mut ajo_info = self.ajos.read(ajo_id);
        assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);
        assert(!ajo_info.collateral_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);
        assert(!ajo_info.payments_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);

        let collateral_class_hash = self.collateral_class_hash.read();
        assert(collateral_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);
        assert(ajo_info.members_address.is_non_zero(), 'Members not deployed');

        let collateral_salt: felt252 = (ajo_id + 2000).try_into().unwrap();
        let mut collateral_calldata = ArrayTrait::new();
        // constructor(owner, monthly_contribution, total_participants, payment_token_address, payments_contract, members_contract)
        let (token_address, _token_decimals): (ContractAddress, u8) = match ajo_info.config
            .payment_token {
            PaymentToken::USDC => (self.usdc_token_address.read(), 6_u8),
            PaymentToken::BTC => (self.btc_token_address.read(), 8_u8),
        };
        assert(token_address.is_non_zero(), 'Token address not configured');
        get_contract_address().serialize(ref collateral_calldata);
        ajo_info.config.monthly_contribution.serialize(ref collateral_calldata);
        ajo_info.config.total_participants.serialize(ref collateral_calldata);
        token_address.serialize(ref collateral_calldata);
        let placeholder_payments: ContractAddress = Zero::zero();
        placeholder_payments.serialize(ref collateral_calldata);
        ajo_info.members_address.serialize(ref collateral_calldata);

        let (collateral_address, _) = deploy_syscall(
            collateral_class_hash, collateral_salt, collateral_calldata.span(), false
        )
            .unwrap_syscall();

        let payments_class_hash = self.payments_class_hash.read();
        assert(payments_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

        let payments_salt: felt252 = (ajo_id + 3000).try_into().unwrap();
        let mut payments_calldata = ArrayTrait::new();
        // constructor(owner, monthly_contribution, total_participants, cycle_duration, payment_token_address, members_contract)
        get_contract_address().serialize(ref payments_calldata);
        ajo_info.config.monthly_contribution.serialize(ref payments_calldata);
        ajo_info.config.total_participants.serialize(ref payments_calldata);
        ajo_info.config.cycle_duration.serialize(ref payments_calldata);
        token_address.serialize(ref payments_calldata);
        ajo_info.members_address.serialize(ref payments_calldata);

        let (payments_address, _) = deploy_syscall(
            payments_class_hash, payments_salt, payments_calldata.span(), false
        )
            .unwrap_syscall();

        let collateral_dispatcher = IAjoCollateralDispatcher { contract_address: collateral_address };
        collateral_dispatcher.set_payments_contract(payments_address);

        ajo_info.collateral_address = collateral_address;
        ajo_info.payments_address = payments_address;
        self.ajos.write(ajo_id, ajo_info);

        self.emit(CollateralDeployed { ajo_id, collateral_address });
        self.emit(PaymentsDeployed { ajo_id, payments_address });

        (collateral_address, payments_address)
    }

    fn deploy_governance_and_schedule_internal(
        ref self: ContractState, ajo_id: u256
    ) -> (ContractAddress, ContractAddress) {
        let mut ajo_info = self.ajos.read(ajo_id);
        assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);
        assert(!ajo_info.governance_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);
        assert(!ajo_info.schedule_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);

        let governance_class_hash = self.governance_class_hash.read();
        assert(governance_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);
        assert(ajo_info.members_address.is_non_zero(), 'Members not deployed');
        assert(ajo_info.collateral_address.is_non_zero(), 'Collateral not deployed');
        assert(ajo_info.payments_address.is_non_zero(), 'Payments not deployed');

        let governance_salt: felt252 = (ajo_id + 4000).try_into().unwrap();
        let mut governance_calldata = ArrayTrait::new();
        // constructor(owner, members_contract, voting_period, quorum_percentage)
        get_contract_address().serialize(ref governance_calldata);
        ajo_info.members_address.serialize(ref governance_calldata);
        604800_u64.serialize(ref governance_calldata);
        51_u256.serialize(ref governance_calldata);

        let (governance_address, _) = deploy_syscall(
            governance_class_hash, governance_salt, governance_calldata.span(), false
        )
            .unwrap_syscall();

        let schedule_class_hash = self.schedule_class_hash.read();
        assert(schedule_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

        let schedule_salt: felt252 = (ajo_id + 5000).try_into().unwrap();
        let mut schedule_calldata = ArrayTrait::new();
        // constructor(owner)
        get_contract_address().serialize(ref schedule_calldata);

        let (schedule_address, _) = deploy_syscall(
            schedule_class_hash, schedule_salt, schedule_calldata.span(), false
        )
            .unwrap_syscall();

        ajo_info.governance_address = governance_address;
        ajo_info.schedule_address = schedule_address;
        finalize_ajo_if_ready(ref self, ref ajo_info);
        self.ajos.write(ajo_id, ajo_info);

        self.emit(GovernanceDeployed { ajo_id, governance_address });
        self.emit(ScheduleDeployed { ajo_id, schedule_address });

        (governance_address, schedule_address)
    }

    fn deploy_core_internal(ref self: ContractState, ajo_id: u256) -> ContractAddress {
        let mut ajo_info = self.ajos.read(ajo_id);
        assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);
        assert(!ajo_info.core_address.is_non_zero(), Errors::PHASE_ALREADY_DEPLOYED);

        let class_hash = self.core_class_hash.read();
        assert(class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

        let salt: felt252 = ajo_id.try_into().unwrap();
        let mut calldata = ArrayTrait::new();
        // constructor(factory_address)
        get_contract_address().serialize(ref calldata);

        let (core_address, _) = deploy_syscall(class_hash, salt, calldata.span(), false)
            .unwrap_syscall();

        ajo_info.core_address = core_address;
        finalize_ajo_if_ready(ref self, ref ajo_info);
        self.ajos.write(ajo_id, ajo_info);

        self.emit(CoreDeployed { ajo_id, core_address });

        core_address
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        core_class_hash: ClassHash,
        members_class_hash: ClassHash,
        collateral_class_hash: ClassHash,
        payments_class_hash: ClassHash,
        governance_class_hash: ClassHash,
        schedule_class_hash: ClassHash,
    ) {
        self.ownable.initializer(owner);
        self.core_class_hash.write(core_class_hash);
        self.members_class_hash.write(members_class_hash);
        self.collateral_class_hash.write(collateral_class_hash);
        self.payments_class_hash.write(payments_class_hash);
        self.governance_class_hash.write(governance_class_hash);
        self.schedule_class_hash.write(schedule_class_hash);
        // Defaults can be overridden by owner via setters.
        self.usdc_token_address.write(starknet::contract_address_const::<'USDC_TOKEN'>());
        self.btc_token_address.write(starknet::contract_address_const::<'BTC_TOKEN'>());
        self.total_ajos.write(0);
    }

    #[abi(embed_v0)]
    impl AjoFactoryImpl of IAjoFactory<ContractState> {
        fn create_ajo(
            ref self: ContractState,
            name: felt252,
            monthly_contribution: u256,
            total_participants: u256,
            cycle_duration: u64,
            payment_token: PaymentToken,
        ) -> u256 {
            self.pausable.assert_not_paused();
            create_ajo_internal(
                ref self,
                name,
                monthly_contribution,
                total_participants,
                cycle_duration,
                payment_token
            )
        }

        fn create_ajo_and_initialize(
            ref self: ContractState,
            name: felt252,
            monthly_contribution: u256,
            total_participants: u256,
            cycle_duration: u64,
            payment_token: PaymentToken,
        ) -> u256 {
            self.pausable.assert_not_paused();

            let ajo_id = create_ajo_internal(
                ref self,
                name,
                monthly_contribution,
                total_participants,
                cycle_duration,
                payment_token
            );

            deploy_members_internal(ref self, ajo_id);
            deploy_collateral_and_payments_internal(ref self, ajo_id);
            deploy_governance_and_schedule_internal(ref self, ajo_id);
            deploy_core_internal(ref self, ajo_id);

            ajo_id
        }

        fn deploy_core(ref self: ContractState, ajo_id: u256) -> ContractAddress {
            self.pausable.assert_not_paused();
            assert_creator(@self, ajo_id);
            deploy_core_internal(ref self, ajo_id)
        }

        fn deploy_members(ref self: ContractState, ajo_id: u256) -> ContractAddress {
            self.pausable.assert_not_paused();
            assert_creator(@self, ajo_id);
            deploy_members_internal(ref self, ajo_id)
        }

        fn deploy_collateral_and_payments(
            ref self: ContractState, ajo_id: u256
        ) -> (ContractAddress, ContractAddress) {
            self.pausable.assert_not_paused();
            assert_creator(@self, ajo_id);
            deploy_collateral_and_payments_internal(ref self, ajo_id)
        }

        fn deploy_governance_and_schedule(
            ref self: ContractState, ajo_id: u256
        ) -> (ContractAddress, ContractAddress) {
            self.pausable.assert_not_paused();
            assert_creator(@self, ajo_id);
            deploy_governance_and_schedule_internal(ref self, ajo_id)
        }

        fn get_ajo_info(self: @ContractState, ajo_id: u256) -> AjoInfo {
            self.ajos.read(ajo_id)
        }

        fn get_user_ajos(self: @ContractState, user: ContractAddress) -> Span<u256> {
            let user_ajos = self.user_ajos.entry(user);
            let len = user_ajos.len();
            let mut result = ArrayTrait::new();
            let mut i: u64 = 0;
            loop {
                if i >= len {
                    break;
                }
                result.append(user_ajos.at(i).read());
                i += 1;
            };
            result.span()
        }

        fn get_total_ajos(self: @ContractState) -> u256 {
            self.total_ajos.read()
        }

        fn set_core_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.core_class_hash.write(class_hash);
        }

        fn set_members_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.members_class_hash.write(class_hash);
        }

        fn set_collateral_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.collateral_class_hash.write(class_hash);
        }

        fn set_payments_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.payments_class_hash.write(class_hash);
        }

        fn set_governance_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.governance_class_hash.write(class_hash);
        }

        fn set_schedule_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.schedule_class_hash.write(class_hash);
        }

        fn set_usdc_token_address(ref self: ContractState, token_address: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(token_address.is_non_zero(), 'Invalid token address');
            self.usdc_token_address.write(token_address);
        }

        fn set_btc_token_address(ref self: ContractState, token_address: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(token_address.is_non_zero(), 'Invalid token address');
            self.btc_token_address.write(token_address);
        }

        fn get_usdc_token_address(self: @ContractState) -> ContractAddress {
            self.usdc_token_address.read()
        }

        fn get_btc_token_address(self: @ContractState) -> ContractAddress {
            self.btc_token_address.read()
        }
    }
}
