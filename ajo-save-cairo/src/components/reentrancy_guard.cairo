#[starknet::component]
pub mod ReentrancyGuardComponent {
    #[storage]
    struct Storage {
        entered: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    pub mod Errors {
        pub const REENTRANT_CALL: felt252 = 'Reentrant call';
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>
    > of InternalTrait<TContractState> {
        fn start(ref self: ComponentState<TContractState>) {
            assert(!self.entered.read(), Errors::REENTRANT_CALL);
            self.entered.write(true);
        }

        fn end(ref self: ComponentState<TContractState>) {
            self.entered.write(false);
        }
    }
}
