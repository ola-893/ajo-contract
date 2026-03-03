// AjoGovernance - On-chain governance with StarkNet consensus
// Replaces Hedera HCS with StarkNet events
// Key features:
// - Proposal creation
// - On-chain voting via events
// - Vote tallying
// - Proposal execution

#[starknet::contract]
pub mod AjoGovernance {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use ajo_save::interfaces::i_ajo_governance::{
        IAjoGovernance, Proposal, ProposalType, ProposalStatus
    };
    use ajo_save::interfaces::types::CollateralMode;
    use ajo_save::interfaces::i_ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
    use ajo_save::interfaces::i_ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
    use ajo_save::components::ownable::{OwnableComponent, IOwnable};
    use core::num::traits::Zero;

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Embeddable implementations
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Proposal tracking
        proposal_count: u256,
        proposals: Map<u256, Proposal>,
        
        // Vote tracking: (proposal_id, voter) → Vote
        votes: Map<(u256, ContractAddress), Vote>,

        // Proposal execution routing data.
        proposal_target: Map<u256, ContractAddress>,
        proposal_arg_len: Map<u256, u256>,
        proposal_arg0: Map<u256, felt252>,
        proposal_arg1: Map<u256, felt252>,
        proposal_arg2: Map<u256, felt252>,
        
        // Configuration
        voting_period: u64,
        quorum_percentage: u256,
        
        // Reference to AjoMembers contract for member verification
        members_contract: ContractAddress,
        authorized_core: ContractAddress,
        
        // Ownable component
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    // Vote struct to track individual votes
    #[derive(Drop, Serde, Copy, starknet::Store)]
    pub struct Vote {
        pub support: bool,
        pub voting_power: u256,
        pub timestamp: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProposalCreated: ProposalCreated,
        VoteCast: VoteCast,
        ProposalExecuted: ProposalExecuted,
        ProposalCancelled: ProposalCancelled,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProposalCreated {
        #[key]
        pub proposal_id: u256,
        pub proposer: ContractAddress,
        pub proposal_type: ProposalType,
        pub description: felt252,
        pub voting_ends_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VoteCast {
        #[key]
        pub proposal_id: u256,
        #[key]
        pub voter: ContractAddress,
        pub support: bool,
        pub voting_power: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProposalExecuted {
        #[key]
        pub proposal_id: u256,
        pub executor: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProposalCancelled {
        #[key]
        pub proposal_id: u256,
        pub canceller: ContractAddress,
    }

    pub mod Errors {
        pub const NOT_MEMBER: felt252 = 'Caller is not a member';
        pub const ZERO_ADDRESS: felt252 = 'Address cannot be zero';
        pub const INVALID_VOTING_PERIOD: felt252 = 'Invalid voting period';
        pub const PROPOSAL_NOT_FOUND: felt252 = 'Proposal not found';
        pub const ALREADY_VOTED: felt252 = 'Already voted';
        pub const VOTING_ENDED: felt252 = 'Voting period ended';
        pub const VOTING_NOT_ENDED: felt252 = 'Voting period not ended';
        pub const PROPOSAL_NOT_PASSED: felt252 = 'Proposal not passed';
        pub const ALREADY_EXECUTED: felt252 = 'Already executed';
        pub const INVALID_PROPOSAL_DATA: felt252 = 'Invalid proposal data';
        pub const INVALID_TARGET: felt252 = 'Invalid proposal target';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        members_contract: ContractAddress,
        voting_period: u64,
        quorum_percentage: u256
    ) {
        // Initialize Ownable component
        self.ownable.initializer(owner);
        
        // Validate and set members contract
        assert(!members_contract.is_zero(), Errors::ZERO_ADDRESS);
        self.members_contract.write(members_contract);
        self.authorized_core.write(owner);
        
        // Validate and set voting period
        assert(voting_period > 0, Errors::INVALID_VOTING_PERIOD);
        self.voting_period.write(voting_period);
        
        // Set quorum percentage (default 51%)
        self.quorum_percentage.write(quorum_percentage);
        
        // Initialize proposal count
        self.proposal_count.write(0);
    }

    // Internal helper functions for proposal verification
    // These functions are used by execute_proposal to verify if a proposal can be executed
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            let authorized = self.authorized_core.read();
            assert(caller == authorized, 'Only authorized core');
        }

        /// Check if a proposal has reached quorum
        /// 
        /// Quorum is met when total votes >= (total_members × quorum_percentage / 100)
        /// 
        /// # Arguments
        /// * `proposal_id` - The ID of the proposal to check
        /// 
        /// # Returns
        /// * `bool` - true if quorum is met, false otherwise
        /// 
        /// # Panics
        /// * If proposal_id does not exist
        fn has_quorum(self: @ContractState, proposal_id: u256) -> bool {
            let proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            
            // Get total members from members contract
            let members_contract = self.members_contract.read();
            let members_dispatcher = IAjoMembersDispatcher { contract_address: members_contract };
            let total_members: u256 = members_dispatcher.get_member_count().into();
            
            // Calculate total votes cast
            let total_votes = proposal.votes_for + proposal.votes_against;
            
            // Calculate required quorum: (total_members × quorum_percentage / 100)
            let quorum_percentage = self.quorum_percentage.read();
            let required_quorum = (total_members * quorum_percentage) / 100;
            
            // Check if quorum is met
            total_votes >= required_quorum
        }

        /// Check if a proposal has passed
        /// 
        /// A proposal passes when support votes > oppose votes
        /// 
        /// # Arguments
        /// * `proposal_id` - The ID of the proposal to check
        /// 
        /// # Returns
        /// * `bool` - true if proposal passed, false otherwise
        /// 
        /// # Panics
        /// * If proposal_id does not exist
        fn is_passed(self: @ContractState, proposal_id: u256) -> bool {
            let proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            
            // Proposal passes if votes_for > votes_against
            proposal.votes_for > proposal.votes_against
        }

        fn read_target(self: @ContractState, proposal_id: u256) -> ContractAddress {
            let target = self.proposal_target.read(proposal_id);
            if target.is_zero() {
                self.authorized_core.read()
            } else {
                target
            }
        }

        fn read_arg(self: @ContractState, proposal_id: u256, index: u256) -> felt252 {
            if index == 0 {
                self.proposal_arg0.read(proposal_id)
            } else if index == 1 {
                self.proposal_arg1.read(proposal_id)
            } else if index == 2 {
                self.proposal_arg2.read(proposal_id)
            } else {
                0
            }
        }

        fn require_args(self: @ContractState, proposal_id: u256, min_len: u256) {
            let arg_len = self.proposal_arg_len.read(proposal_id);
            assert(arg_len >= min_len, Errors::INVALID_PROPOSAL_DATA);
        }
    }

    #[abi(embed_v0)]
    impl AjoGovernanceImpl of IAjoGovernance<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), Errors::ZERO_ADDRESS);
            self.authorized_core.write(core);
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

        fn create_proposal(
            ref self: ContractState,
            proposal_type: ProposalType,
            description: felt252,
            target: ContractAddress,
            calldata: Span<felt252>,
        ) -> u256 {
            let caller = starknet::get_caller_address();
            
            // Validate caller is a member
            let members_contract = self.members_contract.read();
            let members_dispatcher = IAjoMembersDispatcher { contract_address: members_contract };
            assert(members_dispatcher.is_member(caller), Errors::NOT_MEMBER);
            
            // Get current timestamp and calculate voting end time
            let current_time = starknet::get_block_timestamp();
            let voting_period = self.voting_period.read();
            let voting_ends_at = current_time + voting_period;
            
            // Increment proposal count to get new proposal ID
            let current_count = self.proposal_count.read();
            let proposal_id = current_count + 1;
            self.proposal_count.write(proposal_id);
            
            // Create new Proposal struct
            let new_proposal = Proposal {
                id: proposal_id,
                proposer: caller,
                proposal_type: proposal_type,
                description: description,
                votes_for: 0,
                votes_against: 0,
                status: ProposalStatus::Active,
                created_at: current_time,
                voting_ends_at: voting_ends_at,
            };
            
            // Store proposal
            self.proposals.write(proposal_id, new_proposal);
            self.proposal_target.write(proposal_id, target);

            let arg_len: u256 = calldata.len().try_into().unwrap();
            self.proposal_arg_len.write(proposal_id, arg_len);

            if calldata.len() > 0 {
                self.proposal_arg0.write(proposal_id, *calldata.at(0));
            } else {
                self.proposal_arg0.write(proposal_id, 0);
            }

            if calldata.len() > 1 {
                self.proposal_arg1.write(proposal_id, *calldata.at(1));
            } else {
                self.proposal_arg1.write(proposal_id, 0);
            }

            if calldata.len() > 2 {
                self.proposal_arg2.write(proposal_id, *calldata.at(2));
            } else {
                self.proposal_arg2.write(proposal_id, 0);
            }
            
            // Emit ProposalCreated event for indexing
            self.emit(ProposalCreated {
                proposal_id: proposal_id,
                proposer: caller,
                proposal_type: proposal_type,
                description: description,
                voting_ends_at: voting_ends_at,
            });
            
            proposal_id
        }

        fn cast_vote(ref self: ContractState, proposal_id: u256, support: bool) {
            let caller = starknet::get_caller_address();
            
            // Validate proposal exists
            let mut proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            
            // Validate proposal is active
            assert(proposal.status == ProposalStatus::Active, 'Proposal not active');
            
            // Validate voting period hasn't ended
            let current_time = starknet::get_block_timestamp();
            assert(current_time < proposal.voting_ends_at, Errors::VOTING_ENDED);
            
            // Validate caller is a member
            let members_contract = self.members_contract.read();
            let members_dispatcher = IAjoMembersDispatcher { contract_address: members_contract };
            assert(members_dispatcher.is_member(caller), Errors::NOT_MEMBER);
            
            // Validate caller hasn't already voted
            assert(!self.has_voted(proposal_id, caller), Errors::ALREADY_VOTED);
            
            // Calculate voting power (based on reputation or equal for all members)
            let voting_power = self.get_voting_power(caller);
            
            // Record vote in votes mapping
            let vote = Vote {
                support: support,
                voting_power: voting_power,
                timestamp: current_time,
            };
            self.votes.write((proposal_id, caller), vote);
            
            // Update proposal vote counts immediately (on-chain tallying)
            if support {
                proposal.votes_for += voting_power;
            } else {
                proposal.votes_against += voting_power;
            }
            
            // Save updated proposal
            self.proposals.write(proposal_id, proposal);
            
            // Emit VoteCast event for indexing
            self.emit(VoteCast {
                proposal_id: proposal_id,
                voter: caller,
                support: support,
                voting_power: voting_power,
            });
        }

        fn get_voting_power(self: @ContractState, voter: ContractAddress) -> u256 {
            let members_contract = self.members_contract.read();
            let members_dispatcher = IAjoMembersDispatcher { contract_address: members_contract };
            if !members_dispatcher.is_member(voter) {
                return 0;
            }

            let member = members_dispatcher.get_member(voter);
            if member.status == ajo_save::interfaces::types::MemberStatus::Removed
                || member.status == ajo_save::interfaces::types::MemberStatus::Defaulted {
                return 0;
            }

            1
        }

        fn execute_proposal(ref self: ContractState, proposal_id: u256) {
            let caller = starknet::get_caller_address();

            // Validate proposal exists
            let mut proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);

            // Verify voting period has ended
            let current_time = starknet::get_block_timestamp();
            assert(current_time >= proposal.voting_ends_at, Errors::VOTING_NOT_ENDED);

            // Verify proposal hasn't already been executed
            assert(proposal.status != ProposalStatus::Executed, Errors::ALREADY_EXECUTED);

            // Verify proposal has quorum
            assert(self.has_quorum(proposal_id), 'Quorum not met');

            // Verify proposal has passed
            assert(self.is_passed(proposal_id), Errors::PROPOSAL_NOT_PASSED);

            let target = InternalImpl::read_target(@self, proposal_id);
            assert(!target.is_zero(), Errors::INVALID_TARGET);
            let core = IAjoCoreDispatcher { contract_address: target };

            // Execute proposal based on proposal_type
            match proposal.proposal_type {
                ProposalType::AddMember => {
                    InternalImpl::require_args(@self, proposal_id, 2);
                    let member_felt = InternalImpl::read_arg(@self, proposal_id, 0);
                    let position_felt = InternalImpl::read_arg(@self, proposal_id, 1);
                    let member: ContractAddress = member_felt.try_into().unwrap();
                    let position: u256 = position_felt.into();
                    core.governance_add_member(member, position);
                },
                ProposalType::RemoveMember => {
                    InternalImpl::require_args(@self, proposal_id, 1);
                    let member_felt = InternalImpl::read_arg(@self, proposal_id, 0);
                    let member: ContractAddress = member_felt.try_into().unwrap();
                    core.governance_remove_member(member);
                },
                ProposalType::ChangeConfig => {
                    InternalImpl::require_args(@self, proposal_id, 1);
                    let action = InternalImpl::read_arg(@self, proposal_id, 0);
                    let value = InternalImpl::read_arg(@self, proposal_id, 1);

                    if action == 1 {
                        if value == 0 {
                            core.set_collateral_mode(CollateralMode::L2Escrow);
                        } else {
                            core.set_collateral_mode(CollateralMode::BTCCommitment);
                        }
                    } else if action == 2 {
                        core.enable_btc_commitment();
                    } else if action == 3 {
                        core.disable_btc_commitment();
                    } else {
                        assert(false, Errors::INVALID_PROPOSAL_DATA);
                    }
                },
                ProposalType::HandleDefault => {
                    InternalImpl::require_args(@self, proposal_id, 1);
                    let defaulter_felt = InternalImpl::read_arg(@self, proposal_id, 0);
                    let defaulter: ContractAddress = defaulter_felt.try_into().unwrap();
                    core.handle_default(defaulter);
                },
                ProposalType::Emergency => {
                    InternalImpl::require_args(@self, proposal_id, 1);
                    let action = InternalImpl::read_arg(@self, proposal_id, 0);

                    if action == 0 {
                        core.pause();
                    } else if action == 1 {
                        core.unpause();
                    } else if action == 2 {
                        core.emergency_disable_bridge();
                    } else if action == 3 {
                        core.emergency_disable_swap();
                    } else if action == 4 {
                        core.emergency_disable_btc_collateral();
                    } else {
                        assert(false, Errors::INVALID_PROPOSAL_DATA);
                    }
                },
            }

            // Mark proposal as executed
            proposal.status = ProposalStatus::Executed;
            self.proposals.write(proposal_id, proposal);

            // Emit ProposalExecuted event
            self.emit(ProposalExecuted {
                proposal_id: proposal_id,
                executor: caller,
            });
        }

        fn cancel_proposal(ref self: ContractState, proposal_id: u256) {
            let caller = starknet::get_caller_address();
            let mut proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            assert(proposal.status == ProposalStatus::Active, 'Proposal not active');

            let owner = self.ownable.owner();
            assert(caller == proposal.proposer || caller == owner, 'Not authorized to cancel');

            proposal.status = ProposalStatus::Cancelled;
            self.proposals.write(proposal_id, proposal);

            self.emit(ProposalCancelled { proposal_id, canceller: caller });
        }

        fn get_proposal(self: @ContractState, proposal_id: u256) -> Proposal {
            let proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            proposal
        }

        fn get_proposal_status(self: @ContractState, proposal_id: u256) -> ProposalStatus {
            let proposal = self.proposals.read(proposal_id);
            assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
            proposal.status
        }

        fn has_voted(self: @ContractState, proposal_id: u256, voter: ContractAddress) -> bool {
            let vote = self.votes.read((proposal_id, voter));
            vote.timestamp != 0
        }

        fn get_total_proposals(self: @ContractState) -> u256 {
            self.proposal_count.read()
        }

        fn get_quorum(self: @ContractState) -> u256 {
            self.quorum_percentage.read()
        }

        fn get_voting_period(self: @ContractState) -> u64 {
            self.voting_period.read()
        }
    }
}
