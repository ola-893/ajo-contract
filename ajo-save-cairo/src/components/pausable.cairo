#[starknet::interface]
pub trait IPausable<TContractState> {
    fn is_paused(self: @TContractState) -> bool;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::component]
pub mod PausableComponent {
    #[storage]
    struct Storage {
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Paused {
        pub account: starknet::ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Unpaused {
        pub account: starknet::ContractAddress,
    }

    pub mod Errors {
        pub const PAUSED: felt252 = 'Contract is paused';
        pub const NOT_PAUSED: felt252 = 'Contract is not paused';
    }

    #[embeddable_as(PausableImpl)]
    impl Pausable<
        TContractState, +HasComponent<TContractState>
    > of super::IPausable<ComponentState<TContractState>> {
        fn is_paused(self: @ComponentState<TContractState>) -> bool {
            self.paused.read()
        }

        fn pause(ref self: ComponentState<TContractState>) {
            self.assert_not_paused();
            self.paused.write(true);
            self.emit(Paused { account: starknet::get_caller_address() });
        }

        fn unpause(ref self: ComponentState<TContractState>) {
            self.assert_paused();
            self.paused.write(false);
            self.emit(Unpaused { account: starknet::get_caller_address() });
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>
    > of InternalTrait<TContractState> {
        fn assert_not_paused(self: @ComponentState<TContractState>) {
            assert(!self.paused.read(), Errors::PAUSED);
        }

        fn assert_paused(self: @ComponentState<TContractState>) {
            assert(self.paused.read(), Errors::NOT_PAUSED);
        }
    }
}
