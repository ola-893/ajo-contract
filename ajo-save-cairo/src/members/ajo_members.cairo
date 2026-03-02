// AjoMembers - Member queue and guarantor network management
// Manages the member queue (positions 1-10) and implements the circular guarantor network

#[starknet::contract]
pub mod AjoMembers {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{Map, Vec, VecTrait, MutableVecTrait, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use ajo_save::interfaces::types::{Member, MemberStatus};
    use ajo_save::interfaces::i_ajo_members::IAjoMembers;
    use ajo_save::components::ownable::OwnableComponent;
    use core::num::traits::Zero;

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Ownable implementation
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Member data
        members: Map<ContractAddress, Member>,
        position_to_member: Map<u256, ContractAddress>,
        member_list: Vec<ContractAddress>,
        member_count: u256,
        
        // Configuration
        total_participants: u256,
        authorized_core: ContractAddress,
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MemberAdded: MemberAdded,
        MemberRemoved: MemberRemoved,
        MemberStatusUpdated: MemberStatusUpdated,
        PayoutReceived: PayoutReceived,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberAdded {
        #[key]
        pub member: ContractAddress,
        pub position: u256,
        pub guarantor: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberRemoved {
        #[key]
        pub member: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberStatusUpdated {
        #[key]
        pub member: ContractAddress,
        pub old_status: MemberStatus,
        pub new_status: MemberStatus,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutReceived {
        #[key]
        pub member: ContractAddress,
        pub position: u256,
    }

    pub mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Member address is zero';
        pub const INVALID_POSITION: felt252 = 'Invalid position';
        pub const POSITION_TAKEN: felt252 = 'Position already taken';
        pub const MEMBER_EXISTS: felt252 = 'Member already exists';
        pub const MEMBER_NOT_FOUND: felt252 = 'Member not found';
        pub const AJO_FULL: felt252 = 'Ajo is full';
        pub const INVALID_TOTAL_PARTICIPANTS: felt252 = 'Invalid total participants';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, total_participants: u256) {
        // Initialize Ownable component
        self.ownable.initializer(owner);
        
        // Validate and set total participants
        assert(total_participants > 0, Errors::INVALID_TOTAL_PARTICIPANTS);
        self.total_participants.write(total_participants);
        self.member_count.write(0);
        self.authorized_core.write(owner);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            let authorized = self.authorized_core.read();
            assert(caller == authorized, 'Only authorized core');
        }
    }

    #[abi(embed_v0)]
    impl AjoMembersImpl of IAjoMembers<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), Errors::ZERO_ADDRESS);
            self.authorized_core.write(core);
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

        fn add_member(ref self: ContractState, member: ContractAddress, position: u256) {
            InternalImpl::assert_only_core(@self);
            
            // Validate member address is not zero
            assert(!member.is_zero(), Errors::ZERO_ADDRESS);
            
            // Validate position is within valid range (1 to total_participants)
            let total = self.total_participants.read();
            assert(position > 0 && position <= total, Errors::INVALID_POSITION);
            
            // Check if position is already taken
            let existing_at_position = self.position_to_member.entry(position).read();
            assert(existing_at_position.is_zero(), Errors::POSITION_TAKEN);
            
            // Check if member already exists
            let existing_member = self.members.entry(member).read();
            assert(existing_member.address.is_zero(), Errors::MEMBER_EXISTS);
            
            // Check if Ajo is full
            let current_count = self.member_count.read();
            assert(current_count < total, Errors::AJO_FULL);
            
            // Calculate guarantor position using the offset formula
            let guarantor_position = self.calculate_guarantor_position(position);
            let guarantor_address = self.position_to_member.entry(guarantor_position).read();
            
            // Create new Member struct
            let new_member = Member {
                address: member,
                position: position,
                collateral_deposited: 0,
                has_received_payout: false,
                status: MemberStatus::Active,
                join_timestamp: starknet::get_block_timestamp(),
            };
            
            // Update storage mappings
            self.members.entry(member).write(new_member);
            self.position_to_member.entry(position).write(member);
            
            // Add to member list
            let len = self.member_list.len();
            self.member_list.at(len).write(member);
            
            // Increment member count
            self.member_count.write(current_count + 1);
            
            // Emit MemberAdded event
            self.emit(MemberAdded { 
                member: member, 
                position: position, 
                guarantor: guarantor_address 
            });
        }

        fn remove_member(ref self: ContractState, member: ContractAddress) {
            InternalImpl::assert_only_core(@self);
            assert(!member.is_zero(), Errors::ZERO_ADDRESS);

            let member_data = self.members.entry(member).read();
            assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);

            self.position_to_member.entry(member_data.position).write(Zero::zero());

            self.members.entry(member).write(Member {
                address: Zero::zero(),
                position: 0,
                collateral_deposited: 0,
                has_received_payout: false,
                status: MemberStatus::Removed,
                join_timestamp: 0,
            });

            let len = self.member_list.len();
            let mut i: u64 = 0;
            loop {
                if i >= len {
                    break;
                }

                let listed = self.member_list.at(i).read();
                if listed == member {
                    self.member_list.at(i).write(Zero::zero());
                    break;
                }

                i += 1;
            };

            let count = self.member_count.read();
            if count > 0 {
                self.member_count.write(count - 1);
            }

            self.emit(MemberRemoved { member });
        }

        fn update_member_status(
            ref self: ContractState, member: ContractAddress, status: MemberStatus
        ) {
            InternalImpl::assert_only_core(@self);
            
            // Verify member exists
            assert(!member.is_zero(), Errors::ZERO_ADDRESS);
            let mut member_data = self.members.entry(member).read();
            assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);
            
            // Store old status for event
            let old_status = member_data.status;
            
            // Update member status
            member_data.status = status;
            self.members.entry(member).write(member_data);
            
            // Emit MemberStatusUpdated event
            self.emit(MemberStatusUpdated { 
                member: member, 
                old_status: old_status, 
                new_status: status 
            });
        }

        fn get_guarantor(self: @ContractState, member: ContractAddress) -> ContractAddress {
            // Verify member exists
            assert(!member.is_zero(), Errors::ZERO_ADDRESS);
            let member_data = self.members.entry(member).read();
            assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);
            
            // Get member's position
            let position = member_data.position;
            
            // Calculate guarantor position using the offset formula
            let guarantor_position = self.calculate_guarantor_position(position);
            
            // Get guarantor's address from position mapping
            let guarantor_address = self.position_to_member.entry(guarantor_position).read();
            
            // Return guarantor address (may be zero if guarantor hasn't joined yet)
            guarantor_address
        }

        fn calculate_guarantor_position(self: @ContractState, position: u256) -> u256 {
            // Guarantor offset formula: ((position - 1 + (total/2)) % total) + 1
            let total = self.total_participants.read();
            let offset = total / 2;
            ((position - 1 + offset) % total) + 1
        }

        fn get_member(self: @ContractState, address: ContractAddress) -> Member {
            // Verify address is not zero
            assert(!address.is_zero(), Errors::ZERO_ADDRESS);
            
            // Get member data from storage
            let member_data = self.members.entry(address).read();
            
            // Verify member exists
            assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);
            
            member_data
        }

        fn get_member_by_position(self: @ContractState, position: u256) -> Member {
            // Validate position is within valid range
            let total = self.total_participants.read();
            assert(position > 0 && position <= total, Errors::INVALID_POSITION);
            
            // Get member address at this position
            let member_address = self.position_to_member.entry(position).read();
            
            // Verify position is occupied
            assert(!member_address.is_zero(), Errors::MEMBER_NOT_FOUND);
            
            // Get and return member data
            self.members.entry(member_address).read()
        }

        fn get_total_members(self: @ContractState) -> u256 {
            self.member_count.read()
        }

        fn get_member_count(self: @ContractState) -> u256 {
            self.member_count.read()
        }

        fn is_member(self: @ContractState, address: ContractAddress) -> bool {
            let member = self.members.entry(address).read();
            !member.address.is_zero()
        }

        fn get_all_members(self: @ContractState) -> Span<Member> {
            let mut members_array: Array<Member> = ArrayTrait::new();
            let len = self.member_list.len();
            
            // Iterate through full list and skip removed/empty entries.
            let mut i: u64 = 0;
            loop {
                if i >= len {
                    break;
                }
                
                let member_address = self.member_list.at(i).read();
                if !member_address.is_zero() {
                    let member_data = self.members.entry(member_address).read();
                    if !member_data.address.is_zero() {
                        members_array.append(member_data);
                    }
                }
                
                i += 1;
            };
            
            members_array.span()
        }

        fn mark_payout_received(ref self: ContractState, member: ContractAddress) {
            InternalImpl::assert_only_core(@self);
            
            // Verify member exists
            assert(!member.is_zero(), Errors::ZERO_ADDRESS);
            let mut member_data = self.members.entry(member).read();
            assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);
            
            // Mark payout as received
            member_data.has_received_payout = true;
            self.members.entry(member).write(member_data);
            
            // Emit PayoutReceived event
            self.emit(PayoutReceived { 
                member: member, 
                position: member_data.position 
            });
        }

        fn has_received_payout(self: @ContractState, member: ContractAddress) -> bool {
            let member_data = self.members.entry(member).read();
            member_data.has_received_payout
        }
    }
}
