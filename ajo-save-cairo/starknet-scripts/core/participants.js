import { Contract } from 'starknet';
import { colors, printBanner } from '../utils/formatting.js';
import { waitForTransaction, sleep } from '../utils/starknet.js';
import { checkTokenBalance } from '../utils/accounts.js';
import { approveToken } from '../utils/tokens.js';
import { retryWithBackoff } from '../utils/retry.js';
import { CORE_ABI, MEMBERS_ABI } from '../abis/index.js';

/**
 * Setup participants with tokens and approvals
 * @param {Array} accounts - Array of Account objects
 * @param {string} usdcAddress - USDC token contract address
 * @param {Object} usdcAbi - USDC token ABI
 * @param {Object} ajoInfo - Ajo contract addresses
 * @param {Object} config - Configuration with requiredBalance
 * @returns {Array} Array of participant objects
 */
export async function setupParticipants(accounts, usdcAddress, usdcAbi, ajoInfo, config) {
  printBanner("PARTICIPANT SETUP");
  
  const participants = [];
  const names = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
                 "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke"];
  
  console.log(colors.cyan(`  🎯 Setting up ${accounts.length} participants\n`));
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const name = names[i] || `Participant ${i + 1}`;
    
    try {
      console.log(colors.dim(`  👤 ${name}...`));
      
      // Check USDC balance
      const balance = await retryWithBackoff(
        () => checkTokenBalance(account, usdcAddress, usdcAbi),
        `Check balance for ${name}`
      );
      
      const balanceFormatted = (Number(balance) / 1e6).toFixed(2);
      console.log(colors.dim(`     Balance: ${balanceFormatted} USDC`));
      
      if (balance < config.requiredBalance) {
        console.log(colors.yellow(`     ⚠️ Insufficient balance (need ${(Number(config.requiredBalance) / 1e6).toFixed(2)} USDC), skipping`));
        continue;
      }
      
      // Approve collateral contract
      const collateralApproval = balance / 2n;
      await retryWithBackoff(
        () => approveToken(account, usdcAddress, ajoInfo.ajo_collateral, collateralApproval),
        `Approve collateral for ${name}`
      );
      console.log(colors.dim(`     ✓ Collateral approved`));
      
      await sleep(1000);
      
      // Approve payments contract
      const paymentsApproval = balance / 2n;
      await retryWithBackoff(
        () => approveToken(account, usdcAddress, ajoInfo.ajo_payments, paymentsApproval),
        `Approve payments for ${name}`
      );
      console.log(colors.dim(`     ✓ Payments approved`));
      
      participants.push({
        account,
        name,
        address: account.address,
        position: i + 1
      });
      
      console.log(colors.green(`     ✅ ${name} ready\n`));
      
    } catch (error) {
      console.log(colors.red(`     ❌ Setup failed: ${error.message}\n`));
    }
    
    await sleep(1000);
  }
  
  console.log(colors.green(`  ✅ ${participants.length} participants ready\n`));
  return participants;
}

/**
 * Check participant balance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @returns {bigint} Balance
 */
export async function checkParticipantBalance(account, tokenAddress, tokenAbi) {
  return await checkTokenBalance(account, tokenAddress, tokenAbi);
}

/**
 * Approve tokens for participant
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {string} spenderAddress - Spender contract address
 * @param {bigint} amount - Amount to approve
 */
export async function approveTokens(account, tokenAddress, spenderAddress, amount) {
  return await approveToken(account, tokenAddress, spenderAddress, amount);
}

/**
 * Participants join Ajo
 * @param {Array} participants - Array of participant objects
 * @param {string} coreAddress - Ajo core contract address
 * @returns {Array} Array of join results
 */
export async function participantsJoinAjo(participants, coreAddress) {
  printBanner("MEMBER JOINING");
  
  const joinResults = [];
  
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Position     │ Collateral Req. │ Status       │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      const core = new Contract(CORE_ABI, coreAddress, participant.account);
      
      // Join with preferred position = 0 (any position)
      const joinCall = await retryWithBackoff(
        async () => {
          const call = core.populate('join_ajo', [0]);
          const tx = await participant.account.execute(call);
          return await waitForTransaction(participant.account.provider, tx.transaction_hash);
        },
        `${participant.name} joining Ajo`
      );
      
      await sleep(2000);
      
      // Get member info
      const memberInfo = await retryWithBackoff(
        () => core.get_member_info(participant.address),
        `Get member info for ${participant.name}`
      );
      
      const collateral = memberInfo.locked_collateral;
      const position = memberInfo.position;
      
      joinResults.push({
        name: participant.name,
        position: Number(position),
        collateral,
        success: true
      });
      
      const status = colors.green("✅ Joined");
      const collateralFormatted = (Number(collateral) / 1e6).toFixed(2);
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${position.toString().padEnd(12)} │ $${collateralFormatted.padEnd(14)} │ ${status.padEnd(20)} │`
      ));
      
    } catch (error) {
      joinResults.push({
        name: participant.name,
        error: error.message,
        success: false
      });
      
      const status = colors.red("❌ Failed");
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${'N/A'.padEnd(12)} │ ${'N/A'.padEnd(15)} │ ${status.padEnd(20)} │`
      ));
    }
    
    await sleep(2000);
  }
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
  
  const successful = joinResults.filter(r => r.success).length;
  console.log(colors.green(`  ✅ ${successful}/${participants.length} participants joined\n`));
  
  return joinResults;
}

/**
 * Get member information
 * @param {string} coreAddress - Ajo core contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {Object} Member information
 */
export async function getMemberInfo(coreAddress, memberAddress, account) {
  const core = new Contract(CORE_ABI, coreAddress, account);
  return await core.get_member_info(memberAddress);
}

/**
 * Display member table
 * @param {Array} members - Array of member objects
 */
export function displayMemberTable(members) {
  console.log(colors.cyan("\n  📊 Member Information\n"));
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Position     │ Collateral      │ Status       │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  members.forEach((member, index) => {
    const collateralFormatted = (Number(member.collateral) / 1e6).toFixed(2);
    const status = member.is_active ? colors.green("Active") : colors.red("Inactive");
    
    console.log(colors.dim(
      `  │ ${(index+1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ` +
      `${member.position.toString().padEnd(12)} │ $${collateralFormatted.padEnd(14)} │ ${status.padEnd(20)} │`
    ));
  });
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
}

/**
 * Get all members
 * @param {string} membersAddress - Members contract address
 * @param {Account} account - Account to use for query
 * @returns {Array} Array of member addresses
 */
export async function getAllMembers(membersAddress, account) {
  const members = new Contract(MEMBERS_ABI, membersAddress, account);
  const memberCount = await members.get_member_count();
  
  const memberAddresses = [];
  for (let i = 0; i < Number(memberCount); i++) {
    const memberAddress = await members.get_member_at_index(i);
    memberAddresses.push(memberAddress);
  }
  
  return memberAddresses;
}

/**
 * Get member position
 * @param {string} coreAddress - Core contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {number} Member position
 */
export async function getMemberPosition(coreAddress, memberAddress, account) {
  const memberInfo = await getMemberInfo(coreAddress, memberAddress, account);
  return Number(memberInfo.position);
}

/**
 * Get member collateral
 * @param {string} coreAddress - Core contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {bigint} Locked collateral amount
 */
export async function getMemberCollateral(coreAddress, memberAddress, account) {
  const memberInfo = await getMemberInfo(coreAddress, memberAddress, account);
  return memberInfo.locked_collateral;
}
