// Malicious contract for testing reentrancy protection
// This contract attempts to re-enter protected functions during callbacks

use starknet::ContractAddress;
use ajo_save::interfaces::i_ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
use ajo_save::interfaces::i_ajo_collateral::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
use ajo_save::interfaces::i_ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};

#[starknet::interface]
pub trait IMaliciousReentrant<TContractState> {
    fn set_target_core(ref self: TContractState, target: ContractAddress);
    fn set_target_collateral(ref self: TContractState, target: ContractAddress);
    fn set_target_payments(ref self: TContractState, target: ContractAddress);
    fn set_attack_type(ref self: TContractState, attack_type: u8);
    fn trigger_join_ajo(ref self: TContractState, token_index: u256);
    fn trigger_process_payment(ref self: TContractState);
    fn trigger_deposit_collateral(ref self: TContractState, amount: u256);
}

#[starknet::contract]
pub mod MaliciousReentrant {
    use super::{ContractAddress, IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
    use super::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
    use super::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
    use starknet::get_caller_address;
    use ajo_save_tests::utils::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

    #[storage]
    struct Storage {
        target_core: ContractAddress,
        target_collateral: ContractAddress,
        target_payments: ContractAddress,
        attack_type: u8, // 1=join_ajo, 2=process_payment, 3=deposit_collateral, 4=distribute_payout
        attack_triggered: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.attack_triggered.write(false);
    }

    #[abi(embed_v0)]
    impl MaliciousReentrantImpl of super::IMaliciousReentrant<ContractState> {
        fn set_target_core(ref self: ContractState, target: ContractAddress) {
            self.target_core.write(target);
        }

        fn set_target_collateral(ref self: ContractState, target: ContractAddress) {
            self.target_collateral.write(target);
        }

        fn set_target_payments(ref self: ContractState, target: ContractAddress) {
            self.target_payments.write(target);
        }

        fn set_attack_type(ref self: ContractState, attack_type: u8) {
            self.attack_type.write(attack_type);
        }

        fn trigger_join_ajo(ref self: ContractState, token_index: u256) {
            let core = IAjoCoreDispatcher { contract_address: self.target_core.read() };
            core.join_ajo(token_index);
        }

        fn trigger_process_payment(ref self: ContractState) {
            let core = IAjoCoreDispatcher { contract_address: self.target_core.read() };
            core.process_payment();
        }

        fn trigger_deposit_collateral(ref self: ContractState, amount: u256) {
            let collateral = IAjoCollateralDispatcher { 
                contract_address: self.target_collateral.read() 
            };
            collateral.deposit_collateral(amount);
        }
    }

    // ERC20 receiver hook - this is where we attempt reentrancy
    // When tokens are transferred TO this contract, this gets called
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn on_erc20_received(ref self: ContractState) {
            // Only attack once to avoid infinite loop
            if self.attack_triggered.read() {
                return;
            }
            self.attack_triggered.write(true);

            let attack_type = self.attack_type.read();
            
            if attack_type == 1 {
                // Attempt to re-enter join_ajo
                let core = IAjoCoreDispatcher { contract_address: self.target_core.read() };
                core.join_ajo(0); // This should fail with "Reentrant call"
            } else if attack_type == 2 {
                // Attempt to re-enter process_payment
                let core = IAjoCoreDispatcher { contract_address: self.target_core.read() };
                core.process_payment(); // This should fail with "Reentrant call"
            } else if attack_type == 3 {
                // Attempt to re-enter deposit_collateral
                let collateral = IAjoCollateralDispatcher { 
                    contract_address: self.target_collateral.read() 
                };
                collateral.deposit_collateral(100); // This should fail with "Reentrant call"
            } else if attack_type == 4 {
                // Attempt to re-enter distribute_payout
                let core = IAjoCoreDispatcher { contract_address: self.target_core.read() };
                // Note: distribute_payout is internal, so we try process_payment which calls it
                core.process_payment(); // This should fail with "Reentrant call"
            }
        }
    }
}
