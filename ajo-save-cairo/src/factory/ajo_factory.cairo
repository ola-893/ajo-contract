#[starknet::contract]
pub mod AjoFactory {
    use starknet::{
        ContractAddress, ClassHash, get_caller_address, get_block_timestamp,
        syscalls::deploy_syscall, SyscallResultTrait
    };
    use starknet::storage::{
        Map, Vec, VecTrait, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, MutableVecTrait
    };
    use core::num::traits::Zero;
    use ajo_save::interfaces::types::{AjoConfig, AjoInfo, PaymentToken, Constants};
    use ajo_save::interfaces::i_ajo_factory::IAjoFactory;
    use ajo_save::components::ownable::{OwnableComponent, IOwnable};
    use ajo_save::components::pausable::{PausableComponent, IPausable};

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

    pub mod Errors {
        pub const INVALID_PARTICIPANTS: felt252 = 'Invalid participant count';
        pub const INVALID_CONTRIBUTION: felt252 = 'Invalid contribution amount';
        pub const INVALID_CYCLE_DURATION: felt252 = 'Invalid cycle duration';
        pub const AJO_NOT_FOUND: felt252 = 'Ajo not found';
        pub const ALREADY_INITIALIZED: felt252 = 'Ajo already initialized';
        pub const CLASS_HASH_NOT_SET: felt252 = 'Class hash not set';
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

            // Validate inputs
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

            let caller = get_caller_address();
            let ajo_id = self.total_ajos.read() + 1;

            // Create config
            let config = AjoConfig {
                name,
                monthly_contribution,
                total_participants,
                cycle_duration,
                payment_token,
                creator: caller,
            };

            // Create Ajo info
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

            // Store Ajo
            self.ajos.write(ajo_id, ajo_info);
            let user_vec = self.user_ajos.entry(caller);
            let len = user_vec.len();
            user_vec.at(len).write(ajo_id);
            self.total_ajos.write(ajo_id);

            // Emit event
            self
                .emit(
                    AjoCreated {
                        ajo_id, creator: caller, name, monthly_contribution, total_participants
                    }
                );

            ajo_id
        }

        fn deploy_core(ref self: ContractState, ajo_id: u256) -> ContractAddress {
            self.pausable.assert_not_paused();

            let mut ajo_info = self.ajos.read(ajo_id);
            assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);

            let class_hash = self.core_class_hash.read();
            assert(class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            // Deploy core contract
            let salt: felt252 = ajo_id.try_into().unwrap();
            let mut calldata = ArrayTrait::new();
            // Add initialization calldata here

            let (core_address, _) = deploy_syscall(class_hash, salt, calldata.span(), false)
                .unwrap_syscall();

            // Update Ajo info
            ajo_info.core_address = core_address;
            self.ajos.write(ajo_id, ajo_info);

            self.emit(CoreDeployed { ajo_id, core_address });

            core_address
        }

        fn deploy_members(ref self: ContractState, ajo_id: u256) -> ContractAddress {
            self.pausable.assert_not_paused();

            let mut ajo_info = self.ajos.read(ajo_id);
            assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);

            let class_hash = self.members_class_hash.read();
            assert(class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            let salt: felt252 = (ajo_id + 1000).try_into().unwrap();
            let mut calldata = ArrayTrait::new();

            let (members_address, _) = deploy_syscall(class_hash, salt, calldata.span(), false)
                .unwrap_syscall();

            ajo_info.members_address = members_address;
            self.ajos.write(ajo_id, ajo_info);

            self.emit(MembersDeployed { ajo_id, members_address });

            members_address
        }

        fn deploy_collateral_and_payments(
            ref self: ContractState, ajo_id: u256
        ) -> (ContractAddress, ContractAddress) {
            self.pausable.assert_not_paused();

            let mut ajo_info = self.ajos.read(ajo_id);
            assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);

            // Deploy collateral
            let collateral_class_hash = self.collateral_class_hash.read();
            assert(collateral_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            let collateral_salt: felt252 = (ajo_id + 2000).try_into().unwrap();
            let mut collateral_calldata = ArrayTrait::new();

            let (collateral_address, _) = deploy_syscall(
                collateral_class_hash, collateral_salt, collateral_calldata.span(), false
            )
                .unwrap_syscall();

            // Deploy payments
            let payments_class_hash = self.payments_class_hash.read();
            assert(payments_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            let payments_salt: felt252 = (ajo_id + 3000).try_into().unwrap();
            let mut payments_calldata = ArrayTrait::new();

            let (payments_address, _) = deploy_syscall(
                payments_class_hash, payments_salt, payments_calldata.span(), false
            )
                .unwrap_syscall();

            // Update Ajo info
            ajo_info.collateral_address = collateral_address;
            ajo_info.payments_address = payments_address;
            self.ajos.write(ajo_id, ajo_info);

            self.emit(CollateralDeployed { ajo_id, collateral_address });
            self.emit(PaymentsDeployed { ajo_id, payments_address });

            (collateral_address, payments_address)
        }

        fn deploy_governance_and_schedule(
            ref self: ContractState, ajo_id: u256
        ) -> (ContractAddress, ContractAddress) {
            self.pausable.assert_not_paused();

            let mut ajo_info = self.ajos.read(ajo_id);
            assert(ajo_info.id != 0, Errors::AJO_NOT_FOUND);

            // Deploy governance
            let governance_class_hash = self.governance_class_hash.read();
            assert(governance_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            let governance_salt: felt252 = (ajo_id + 4000).try_into().unwrap();
            let mut governance_calldata = ArrayTrait::new();

            let (governance_address, _) = deploy_syscall(
                governance_class_hash, governance_salt, governance_calldata.span(), false
            )
                .unwrap_syscall();

            // Deploy schedule
            let schedule_class_hash = self.schedule_class_hash.read();
            assert(schedule_class_hash.is_non_zero(), Errors::CLASS_HASH_NOT_SET);

            let schedule_salt: felt252 = (ajo_id + 5000).try_into().unwrap();
            let mut schedule_calldata = ArrayTrait::new();

            let (schedule_address, _) = deploy_syscall(
                schedule_class_hash, schedule_salt, schedule_calldata.span(), false
            )
                .unwrap_syscall();

            // Update Ajo info and mark as initialized
            ajo_info.governance_address = governance_address;
            ajo_info.schedule_address = schedule_address;
            ajo_info.is_initialized = true;
            self.ajos.write(ajo_id, ajo_info);

            self.emit(GovernanceDeployed { ajo_id, governance_address });
            self.emit(ScheduleDeployed { ajo_id, schedule_address });

            (governance_address, schedule_address)
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
    }
}
