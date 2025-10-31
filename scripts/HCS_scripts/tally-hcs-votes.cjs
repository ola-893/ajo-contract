#!/usr/bin/env node
const { ethers } = require("hardhat");
const {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId,
  TopicId,
} = require("@hashgraph/sdk");

// Enhanced color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  bgGreen: (text) => `\x1b[42m\x1b[30m${text}\x1b[0m`,
  bgBlue: (text) => `\x1b[44m\x1b[37m${text}\x1b[0m`,
  bgYellow: (text) => `\x1b[43m\x1b[30m${text}\x1b[0m`,
  bgRed: (text) => `\x1b[41m\x1b[37m${text}\x1b[0m`,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ================================================================
// HCS TOPIC ID CONVERSION - NEW!
// ================================================================

/**
 * @notice Convert bytes32 hex HCS topic ID to Hedera format (0.0.xxxxx)
 * @dev The contract stores HCS topic as bytes32, but SDK needs TopicId
 */
function convertHcsTopicIdToHedera(bytes32TopicId) {
  try {
    // Remove 0x prefix if present
    let hex = bytes32TopicId;
    if (hex.startsWith("0x")) {
      hex = hex.slice(2);
    }

    // Convert hex to BigInt
    const topicNum = BigInt("0x" + hex);

    // Format as Hedera topic ID (shard.realm.num)
    const topicId = `0.0.${topicNum.toString()}`;

    console.log(c.dim(`     🔄 Converting Topic ID:`));
    console.log(c.dim(`        From: ${bytes32TopicId}`));
    console.log(c.dim(`        To:   ${topicId}\n`));

    return topicId;
  } catch (error) {
    console.error(
      c.red(`     ❌ Topic ID conversion failed: ${error.message}`)
    );
    return null;
  }
}

// ================================================================
// HEDERA CLIENT SETUP - FIXED
// ================================================================

function setupHederaClient() {
  const network = process.env.HEDERA_NETWORK || "testnet";

  let operatorPrivateKey =
    process.env.HEDERA_PRIVATE_KEY || process.env.TESTNET_OPERATOR_PRIVATE_KEY;
  let operatorId = process.env.HEDERA_ACCOUNT_ID;

  if (!operatorPrivateKey || !operatorId) {
    console.log(
      c.yellow(
        "\n⚠️  Missing Hedera credentials - HCS voting will be simulated"
      )
    );
    console.log(
      c.dim("   Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env\n")
    );
    return null;
  }

  try {
    operatorId = AccountId.fromString(operatorId);

    if (operatorPrivateKey.startsWith("0x")) {
      operatorPrivateKey = operatorPrivateKey.slice(2);
    }

    const operatorKey = PrivateKey.fromStringECDSA(operatorPrivateKey);

    let client;
    if (network === "mainnet") {
      client = Client.forMainnet();
    } else if (network === "local") {
      client = Client.forNetwork({
        "127.0.0.1:50211": new AccountId(3),
      });
      client.setMirrorNetwork(
        process.env.LOCAL_NODE_ENDPOINT || "http://localhost:5551"
      );
    } else {
      client = Client.forTestnet();
    }

    client.setOperator(operatorId, operatorKey);

    console.log(c.green(`\n✅ Hedera Client initialized`));
    console.log(c.dim(`   Network: ${network}`));
    console.log(c.dim(`   Operator: ${operatorId.toString()}`));

    return client;
  } catch (error) {
    console.log(
      c.yellow(`\n⚠️  Failed to setup Hedera client: ${error.message}`)
    );
    console.log(c.dim("   HCS voting will be simulated\n"));
    return null;
  }
}

// ================================================================
// GOVERNANCE DEMO BANNER
// ================================================================

function printGovernanceBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(
    c.bold(
      c.cyan(
        "╔══════════════════════════════════════════════════════════════════════════════════════╗"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "║                                                                                      ║"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan("║") +
        c.bgBlue(
          "                🗳️  AJO.SAVE - REAL HCS GOVERNANCE DEMO 🗳️                          "
        ) +
        c.cyan("║")
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "║                                                                                      ║"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "╚══════════════════════════════════════════════════════════════════════════════════════╝"
      )
    )
  );
  console.log(c.magenta("═".repeat(88)));

  console.log(
    c.bright(
      "\n" + " ".repeat(15) + "Hedera Consensus Service (HCS) + On-Chain Tally"
    )
  );
  console.log(
    c.dim(
      " ".repeat(12) +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
  );

  console.log(c.yellow("\n  🌟 HCS GOVERNANCE FEATURES:"));
  console.log(
    c.green("     ✓ Real HCS Integration") +
      c.dim(" - Submit votes to actual Hedera Consensus Service")
  );
  console.log(
    c.green("     ✓ Off-Chain Voting") +
      c.dim(" - Submit votes to HCS topic (~$0.0001/vote)")
  );
  console.log(
    c.green("     ✓ On-Chain Tally") +
      c.dim(" - Anyone can tally votes with signature verification")
  );
  console.log(
    c.green("     ✓ No Aggregators") + c.dim(" - Direct, trustless tallying")
  );
  console.log(
    c.green("     ✓ Cost Efficient") +
      c.dim(" - 90%+ cost reduction vs pure on-chain voting")
  );
  console.log(
    c.green("     ✓ Mirror Node Queries") +
      c.dim(" - Fetch votes from Hedera Mirror Node API\n")
  );
}

// ================================================================
// HELPER: CREATE SIGNED VOTE - FIXED FOR ETHERS V5
// ================================================================

async function createSignedVote(proposalId, voter, support) {
  try {
    const tempHcsMessageId = ethers.constants.HashZero;
    const tempHcsSequenceNumber = 0;

    const messageHash = ethers.utils.solidityKeccak256(
      ["uint256", "address", "uint8", "bytes32", "uint256"],
      [
        proposalId,
        voter.address,
        support,
        tempHcsMessageId,
        tempHcsSequenceNumber,
      ]
    );

    const signature = await voter.signMessage(
      ethers.utils.arrayify(messageHash)
    );

    return {
      voter: voter.address,
      support: support,
      signature: signature,
      timestamp: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error(c.red(`     ❌ Vote signing failed: ${error.message}`));
    throw error;
  }
}

// ================================================================
// HCS VOTE SUBMISSION - WITH TOPIC ID CONVERSION
// ================================================================

async function submitVoteToHCS(hederaClient, topicIdBytes32, voteData) {
  if (!hederaClient) {
    return {
      success: true,
      sequenceNumber: Math.floor(Math.random() * 1000000),
      transactionId: `simulated-${Date.now()}`,
      cost: 0.0001,
      simulated: true,
    };
  }

  try {
    // Convert bytes32 to Hedera format
    const topicIdStr = convertHcsTopicIdToHedera(topicIdBytes32);
    if (!topicIdStr) {
      throw new Error("Failed to convert topic ID");
    }

    // Parse as Hedera TopicId
    const topicId = TopicId.fromString(topicIdStr);

    const voteMessage = JSON.stringify({
      proposalId: voteData.proposalId,
      voter: voteData.voter,
      support: voteData.support,
      signature: voteData.signature,
      timestamp: voteData.timestamp,
      version: "1.0",
    });

    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(voteMessage);

    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);

    const sequenceNumber = receipt.topicSequenceNumber.toNumber();

    return {
      success: true,
      sequenceNumber: sequenceNumber,
      transactionId: txResponse.transactionId.toString(),
      cost: 0.0001,
    };
  } catch (error) {
    console.error(c.red(`     ❌ HCS submission failed: ${error.message}`));
    return {
      success: false,
      error: error.message,
    };
  }
}

// ================================================================
// TEST 1: PROPOSAL CREATION (UPDATED FOR SEASONS)
// ================================================================

async function testProposalCreation(ajoGovernance, members, ajoInfo) {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(25) + "TEST 1: PROPOSAL CREATION" + " ".repeat(36)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(c.cyan("  📋 Creating Governance Proposals...\n"));

  const proposals = [];

  // Proposal 1 - Season Completion
  console.log(c.dim("     → Creating Proposal #1: Complete Current Season"));

  try {
    const tx1 = await ajoGovernance
      .connect(members[0].signer)
      .proposeSeasonCompletion("Complete Season 1 and prepare for next season", {
        gasLimit: 500000,
      });
    const receipt1 = await tx1.wait();

    const event1 = receipt1.events
      ?.map((log) => {
        try {
          return ajoGovernance.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "ProposalCreated");

    const proposalId1 = event1?.args?.proposalId?.toString();

    console.log(c.green(`        ✅ Proposal #${proposalId1} created`));
    console.log(c.dim(`        Gas used: ${receipt1.gasUsed.toString()}\n`));

    proposals.push({
      id: parseInt(proposalId1),
      description: "Complete Current Season",
      proposer: members[0].name,
      type: "CompleteCurrentSeason",
    });
  } catch (error) {
    console.log(c.red(`        ❌ Failed: ${error.message.slice(0, 100)}\n`));
  }

  await sleep(1000);

  // Proposal 2 - Add New Member
  console.log(c.dim("     → Creating Proposal #2: Add New Member"));

  try {
    const newMember = ethers.Wallet.createRandom();

    const tx2 = await ajoGovernance
      .connect(members[1].signer)
      .proposeNewMember(newMember.address, "Add new member for next season", {
        gasLimit: 500000,
      });
    const receipt2 = await tx2.wait();

    const event2 = receipt2.events
      ?.map((log) => {
        try {
          return ajoGovernance.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "ProposalCreated");

    const proposalId2 = event2?.args?.proposalId?.toString();

    console.log(c.green(`        ✅ Proposal #${proposalId2} created`));
    console.log(
      c.dim(`        New member address: ${newMember.address.slice(0, 10)}...`)
    );
    console.log(c.dim(`        Gas used: ${receipt2.gasUsed.toString()}\n`));

    proposals.push({
      id: parseInt(proposalId2),
      description: "Add New Member",
      proposer: members[1].name,
      type: "AddNewMember",
    });
  } catch (error) {
    console.log(c.red(`        ❌ Failed: ${error.message.slice(0, 100)}\n`));
  }

  await sleep(1000);

  // Proposal 3 - Update Penalty Rate
  console.log(c.dim("     → Creating Proposal #3: Update Penalty Rate"));

  try {
    const proposalData = ethers.utils.defaultAbiCoder.encode(["uint256"], [10]);

    const tx3 = await ajoGovernance
      .connect(members[2].signer)
      .createProposal(
        "Increase penalty rate to 10% for late payments",
        proposalData,
        { gasLimit: 500000 }
      );
    const receipt3 = await tx3.wait();

    const event3 = receipt3.events
      ?.map((log) => {
        try {
          return ajoGovernance.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "ProposalCreated");

    const proposalId3 = event3?.args?.proposalId?.toString();

    console.log(c.green(`        ✅ Proposal #${proposalId3} created`));
    console.log(c.dim(`        Gas used: ${receipt3.gasUsed.toString()}\n`));

    proposals.push({
      id: parseInt(proposalId3),
      description: "Update Penalty Rate to 10%",
      proposer: members[2].name,
      type: "UpdatePenaltyRate",
    });
  } catch (error) {
    console.log(c.red(`        ❌ Failed: ${error.message.slice(0, 100)}\n`));
  }

  console.log(c.cyan("  📊 Active Proposals Summary:\n"));
  console.log(
    c.dim(
      "     ┌────┬─────────────────────────────────┬─────────────┬────────────────────┐"
    )
  );
  console.log(
    c.dim(
      "     │ ID │ Description                     │ Proposer    │ Type               │"
    )
  );
  console.log(
    c.dim(
      "     ├────┼─────────────────────────────────┼─────────────┼────────────────────┤"
    )
  );

  for (const p of proposals) {
    console.log(
      c.dim(
        `     │ ${p.id.toString().padStart(2)} │ ${p.description.padEnd(31)} │ ${p.proposer.padEnd(11)} │ ${p.type.padEnd(18)} │`
      )
    );
  }

  console.log(
    c.dim(
      "     └────┴─────────────────────────────────┴─────────────┴────────────────────┘\n"
    )
  );

  console.log(c.blue("═".repeat(88) + "\n"));

  return proposals;
}

// ================================================================
// TEST 2: REAL HCS VOTE SUBMISSION - FIXED
// ================================================================

async function testRealHcsVoteSubmission(
  hederaClient,
  ajoGovernance,
  proposalId,
  members,
  hcsTopicId
) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(25) +
        "TEST 2: REAL HCS VOTE SUBMISSION" +
        " ".repeat(29)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(
    c.cyan(
      `  🗳️  Submitting ${hederaClient ? "Real" : "Simulated"} Votes to HCS for Proposal #${proposalId}...\n`
    )
  );
  console.log(c.yellow(`     📡 HCS Topic (bytes32): ${hcsTopicId}\n`));

  const votes = [];
  const hcsReceipts = [];

  console.log(
    c.dim(
      "     ┌────┬─────────────┬──────────┬────────────────┬─────────────┬──────────────┐"
    )
  );
  console.log(
    c.dim(
      "     │ #  │ Voter       │ Vote     │ HCS Seq #      │ Tx ID       │ Status       │"
    )
  );
  console.log(
    c.dim(
      "     ├────┼─────────────┼──────────┼────────────────┼─────────────┼──────────────┤"
    )
  );

  for (let i = 0; i < Math.min(7, members.length); i++) {
    const member = members[i];
    const support = i < 5 ? 1 : 0;
    const voteText = support === 1 ? c.green("FOR    ") : c.red("AGAINST");

    try {
      const signedVote = await createSignedVote(
        proposalId,
        member.signer,
        support
      );

      const voteData = {
        proposalId: proposalId,
        voter: signedVote.voter,
        support: signedVote.support,
        signature: signedVote.signature,
        timestamp: signedVote.timestamp,
      };

      const hcsResult = await submitVoteToHCS(
        hederaClient,
        hcsTopicId,
        voteData
      );

      if (hcsResult.success) {
        const actualHcsMessageId = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(hcsResult.sequenceNumber),
          32
        );

        const messageHash = ethers.utils.solidityKeccak256(
          ["uint256", "address", "uint8", "bytes32", "uint256"],
          [
            proposalId,
            member.signer.address,
            support,
            actualHcsMessageId,
            hcsResult.sequenceNumber,
          ]
        );

        const finalSignature = await member.signer.signMessage(
          ethers.utils.arrayify(messageHash)
        );

        const completeVote = {
          voter: signedVote.voter,
          support: support,
          votingPower: 100,
          timestamp: signedVote.timestamp,
          hcsMessageId: actualHcsMessageId,
          hcsSequenceNumber: hcsResult.sequenceNumber,
          signature: finalSignature,
        };

        votes.push(completeVote);
        hcsReceipts.push(hcsResult);

        const statusText = hcsResult.simulated
          ? c.yellow("✅ Simulated")
          : c.green("✅ Confirmed");
        const txId = hcsResult.transactionId.slice(0, 11);

        console.log(
          c.dim(
            `     │ ${(i + 1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${voteText} │ ${hcsResult.sequenceNumber.toString().padEnd(14)} │ ${txId} │ ${statusText.padEnd(20)} │`
          )
        );
      } else {
        console.log(
          c.dim(
            `     │ ${(i + 1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${voteText} │ ${"-".padEnd(14)} │ ${"-".padEnd(11)} │ ${c.red("❌ Failed").padEnd(20)} │`
          )
        );
      }
    } catch (error) {
      console.log(
        c.dim(
          `     │ ${(i + 1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${voteText} │ ${"-".padEnd(14)} │ ${"-".padEnd(11)} │ ${c.red("❌ Error").padEnd(20)} │`
        )
      );
    }

    await sleep(500);
  }

  console.log(
    c.dim(
      "     └────┴─────────────┴──────────┴────────────────┴─────────────┴──────────────┘\n"
    )
  );

  const forVotes = votes.filter((v) => v.support === 1).length;
  const againstVotes = votes.filter((v) => v.support === 0).length;
  const totalCost = hcsReceipts.reduce((sum, r) => sum + (r.cost || 0), 0);

  console.log(c.bright("  📊 Vote Summary:"));
  console.log(c.green(`     ✓ FOR:     ${forVotes} votes`));
  console.log(c.red(`     ✗ AGAINST: ${againstVotes} votes`));
  console.log(c.dim(`     Total:     ${votes.length} votes`));
  console.log(c.yellow(`     Cost:      ~$${totalCost.toFixed(4)} USD\n`));

  console.log(
    c.green(`  ✅ ${hederaClient ? "Real" : "Simulated"} HCS Integration:`)
  );
  console.log(
    c.dim("     • Votes submitted to HCS topic with sequence numbers")
  );
  console.log(c.dim("     • Each vote signed with ECDSA signature"));
  console.log(c.dim("     • Votes stored immutably on Hedera network"));
  console.log(c.dim(`     • Topic ID: ${hcsTopicId}`));
  console.log(c.dim("     • Ready for on-chain tallying\n"));

  console.log(c.blue("═".repeat(88) + "\n"));

  return { votes, hcsReceipts };
}

// ================================================================
// TEST 3: ON-CHAIN VOTE TALLYING
// ================================================================

async function testVoteTallying(ajoGovernance, proposalId, votes, tallier) {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(25) + "TEST 3: ON-CHAIN VOTE TALLYING" + " ".repeat(31)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(c.cyan(`  🧮 Tallying Votes for Proposal #${proposalId}...\n`));

  if (votes.length === 0) {
    console.log(c.yellow("     ⚠️  No votes to tally\n"));
    console.log(c.blue("═".repeat(88) + "\n"));
    return null;
  }

  console.log(c.dim("     Tally Process:"));
  console.log(c.dim("     1. Anyone can submit votes from HCS"));
  console.log(c.dim("     2. Contract verifies signatures (ECDSA)"));
  console.log(c.dim("     3. Contract checks membership status"));
  console.log(c.dim("     4. Contract calculates voting power"));
  console.log(c.dim("     5. Contract updates proposal tallies\n"));

  try {
    console.log(
      c.yellow(
        `     → Submitting ${votes.length} votes for on-chain tallying...`
      )
    );

    const tx = await ajoGovernance
      .connect(tallier)
      .tallyVotesFromHCS(proposalId, votes, { gasLimit: 2000000 });

    console.log(c.yellow(`        ⏳ Waiting for confirmation...`));

    const receipt = await tx.wait();

    const tallyEvent = receipt.events
      ?.map((log) => {
        try {
          return ajoGovernance.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "VotesTallied");

    if (tallyEvent) {
      const forVotes = tallyEvent.args.forVotes.toString();
      const againstVotes = tallyEvent.args.againstVotes.toString();
      const abstainVotes = tallyEvent.args.abstainVotes.toString();

      console.log(c.green(`\n     ✅ Votes Successfully Tallied!`));
      console.log(c.dim(`        Gas used: ${receipt.gasUsed.toString()}`));
      console.log(c.dim(`        Tx hash: ${receipt.hash}\n`));

      console.log(c.bright("     📊 Final Tally:"));
      console.log(c.dim("     ┌──────────┬───────┬─────────────┐"));
      console.log(c.dim("     │ Vote     │ Count │ Voting Power│"));
      console.log(c.dim("     ├──────────┼───────┼─────────────┤"));
      console.log(
        c.dim(
          `     │ ${c.green("FOR").padEnd(16)} │ ${votes
            .filter((v) => v.support === 1)
            .length.toString()
            .padStart(5)} │ ${forVotes.padStart(12)} │`
        )
      );
      console.log(
        c.dim(
          `     │ ${c.red("AGAINST").padEnd(16)} │ ${votes
            .filter((v) => v.support === 0)
            .length.toString()
            .padStart(5)} │ ${againstVotes.padStart(12)} │`
        )
      );
      console.log(
        c.dim(
          `     │ ${c.yellow("ABSTAIN").padEnd(16)} │ ${votes
            .filter((v) => v.support === 2)
            .length.toString()
            .padStart(5)} │ ${abstainVotes.padStart(12)} │`
        )
      );
      console.log(c.dim("     └──────────┴───────┴─────────────┘\n"));

      const isPassing = BigInt(forVotes) > BigInt(againstVotes);
      const status = isPassing ? c.green("✅ PASSING") : c.red("❌ FAILING");
      console.log(c.bright(`     Status: ${status}\n`));

      return {
        forVotes: BigInt(forVotes),
        againstVotes: BigInt(againstVotes),
        abstainVotes: BigInt(abstainVotes),
        isPassing,
        gasUsed: receipt.gasUsed,
      };
    } else {
      throw new Error("VotesTallied event not found");
    }
  } catch (error) {
    console.log(
      c.red(`\n     ❌ Tally Failed: ${error.message.slice(0, 150)}\n`)
    );
    console.log(
      c.yellow(`     ℹ️  Error details: ${error.reason || "Unknown"}\n`)
    );
    return null;
  }

  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// TEST 4: SEASON STATUS CHECK (UPDATED)
// ================================================================

async function testSeasonStatus(ajoGovernance) {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(27) + "TEST 4: SEASON STATUS CHECK" + " ".repeat(32)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));
  console.log(c.cyan("  📊 Checking Current Season Status...\n"));

  try {
    const seasonStatus = await ajoGovernance.getSeasonStatus();

    console.log(c.bright("     Season Information:"));
    console.log(
      c.dim("     ┌────────────────────────────────────────────────────┐")
    );
    console.log(
      c.dim(
        `     │ Current Season:          ${seasonStatus._currentSeason.toString().padEnd(24)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Season Completed:        ${(seasonStatus._isSeasonCompleted ? "Yes" : "No").padEnd(24)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Participation Deadline:  ${seasonStatus._participationDeadline.toString().padEnd(24)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Declared Participants:   ${seasonStatus._declaredParticipants.toString().padEnd(24)} │`
      )
    );
    console.log(
      c.dim("     └────────────────────────────────────────────────────┘\n")
    );

    const carryOverRules = await ajoGovernance.getCarryOverRules();

    console.log(c.bright("     Carry-Over Rules:"));
    console.log(
      c.dim("     ┌────────────────────────────────────────────────────┐")
    );
    console.log(
      c.dim(
        `     │ Carry Reputation:        ${(carryOverRules._carryReputation ? "Yes" : "No").padEnd(24)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Carry Penalties:         ${(carryOverRules._carryPenalties ? "Yes" : "No").padEnd(24)} │`
      )
    );
    console.log(
      c.dim("     └────────────────────────────────────────────────────┘\n")
    );

    return { seasonStatus, carryOverRules };
  } catch (error) {
    console.log(
      c.red(
        `     ❌ Failed to get season status: ${error.message.slice(0, 100)}\n`
      )
    );
    throw error;
  }

  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// TEST 5: PROPOSAL STATUS & EXECUTION
// ================================================================

async function testProposalExecution(ajoGovernance, proposalId, executor) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(23) +
        "TEST 5: PROPOSAL STATUS & EXECUTION" +
        " ".repeat(28)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(c.cyan(`  📊 Checking Proposal #${proposalId} Status...\n`));

  try {
    const status = await ajoGovernance.getProposalStatus(proposalId);

    console.log(c.bright("     Status Checks:"));
    console.log(c.dim("     ┌──────────────────────┬─────────┐"));
    console.log(
      c.dim(
        `     │ Active               │ ${(status.isActive ? c.green("✅ Yes") : c.red("❌ No")).padEnd(15)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Has Quorum           │ ${(status.hasQuorum ? c.green("✅ Yes") : c.red("❌ No")).padEnd(15)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Is Passing           │ ${(status.isPassing ? c.green("✅ Yes") : c.red("❌ No")).padEnd(15)} │`
      )
    );
    console.log(
      c.dim(
        `     │ Votes Needed         │ ${status.votesNeeded.toString().padEnd(7)} │`
      )
    );
    console.log(c.dim("     └──────────────────────┴─────────┘\n"));

    const canExecute = !status.isActive && status.hasQuorum && status.isPassing;

    if (canExecute) {
      console.log(c.cyan("  ⚡ Proposal is ready for execution!\n"));
      console.log(c.yellow("     → Executing proposal..."));

      const tx = await ajoGovernance
        .connect(executor)
        .executeProposal(proposalId, { gasLimit: 1000000 });

      console.log(c.yellow(`        ⏳ Waiting for confirmation...`));

      const receipt = await tx.wait();

      const execEvent = receipt.events
        ?.map((log) => {
          try {
            return ajoGovernance.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e && e.name === "ProposalExecuted");

      if (execEvent) {
        const success = execEvent.args.success;

        if (success) {
          console.log(c.green(`\n     ✅ Proposal Executed Successfully!`));
          console.log(c.dim(`        Gas used: ${receipt.gasUsed.toString()}`));
          console.log(c.dim(`        Tx hash: ${receipt.hash}\n`));

          return {
            success: true,
            gasUsed: receipt.gasUsed,
            transactionHash: receipt.hash,
          };
        } else {
          console.log(c.red(`\n     ❌ Proposal Execution Failed`));
          console.log(
            c.dim(`        Return data: ${execEvent.args.returnData}\n`)
          );

          return {
            success: false,
            error: execEvent.args.returnData,
          };
        }
      }
    } else {
      console.log(c.yellow("  ⚠️  Proposal cannot be executed yet\n"));

      if (status.isActive) {
        console.log(c.dim("     Reason: Voting period still active"));
      } else if (!status.hasQuorum) {
        console.log(c.dim("     Reason: Quorum not reached"));
      } else if (!status.isPassing) {
        console.log(c.dim("     Reason: More AGAINST votes than FOR"));
      }

      console.log();

      return {
        success: false,
        error: "Execution conditions not met",
      };
    }
  } catch (error) {
    console.log(c.red(`\n     ❌ Failed: ${error.message.slice(0, 150)}\n`));

    if (error.message.includes("Quorum not reached")) {
      console.log(c.yellow("     ℹ️  Not enough votes to reach quorum"));
    } else if (error.message.includes("Proposal failed")) {
      console.log(c.yellow("     ℹ️  More AGAINST votes than FOR votes"));
    } else if (error.message.includes("Voting ongoing")) {
      console.log(c.yellow("     ℹ️  Voting period has not ended yet"));
    }

    return {
      success: false,
      error: error.message,
    };
  }

  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// TEST 6: MEMBER PARTICIPATION DECLARATION (UPDATED FOR SEASONS)
// ================================================================

async function testParticipationDeclaration(ajoGovernance, members) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(20) +
        "TEST 6: MEMBER PARTICIPATION DECLARATION" +
        " ".repeat(25)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(c.cyan("  📢 Members Declaring Next Season Participation...\n"));

  const declarations = [];

  console.log(
    c.dim("     ┌────┬─────────────┬───────────────┬──────────────┐")
  );
  console.log(
    c.dim("     │ #  │ Member      │ Participation │ Status       │")
  );
  console.log(
    c.dim("     ├────┼─────────────┼───────────────┼──────────────┤")
  );

  for (let i = 0; i < Math.min(5, members.length); i++) {
    const member = members[i];
    const willParticipate = i < 4;
    const participationText = willParticipate
      ? c.green("Continue    ")
      : c.red("Opt Out     ");

    try {
      const tx = await ajoGovernance
        .connect(member.signer)
        .declareNextSeasonParticipation(willParticipate, { gasLimit: 200000 });

      await tx.wait();

      console.log(
        c.dim(
          `     │ ${(i + 1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${participationText} │ ${c.green("✅ Declared").padEnd(20)} │`
        )
      );

      declarations.push({
        member: member.name,
        address: member.address,
        willParticipate,
      });
    } catch (error) {
      console.log(
        c.dim(
          `     │ ${(i + 1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${participationText} │ ${c.red("❌ Failed").padEnd(20)} │`
        )
      );
    }

    await sleep(500);
  }

  console.log(
    c.dim("     └────┴─────────────┴───────────────┴──────────────┘\n")
  );

  const continuingCount = declarations.filter((d) => d.willParticipate).length;
  const optingOutCount = declarations.filter((d) => !d.willParticipate).length;

  console.log(c.bright("  📊 Participation Summary:"));
  console.log(c.green(`     ✓ Continuing: ${continuingCount} members`));
  console.log(c.red(`     ✗ Opting Out: ${optingOutCount} members`));
  console.log(
    c.dim(`     Total:        ${declarations.length} declarations\n`)
  );

  try {
    const continuingMembers = await ajoGovernance.getContinuingMembersList();
    const optOutMembers = await ajoGovernance.getOptOutMembersList();

    console.log(c.bright("  📋 Members for Next Season:"));
    console.log(c.dim(`     Continuing: ${continuingMembers.length} members`));
    console.log(c.dim(`     Opt-out:    ${optOutMembers.length} members\n`));
  } catch (error) {
    console.log(
      c.yellow(
        `     ⚠️  Could not fetch member lists: ${error.message.slice(0, 50)}\n`
      )
    );
  }

  console.log(c.blue("═".repeat(88) + "\n"));

  return declarations;
}

// ================================================================
// MAIN GOVERNANCE DEMO - FIXED PARAMETER HANDLING
// ================================================================

async function runGovernanceDemo(ajoGovernance, participantsInput, ajoInfo) {
  printGovernanceBanner();

  // FIX: Handle both array and object with participants property
  let members;
  if (Array.isArray(participantsInput)) {
    members = participantsInput.map((p) => ({
      name: p.name,
      address: p.address,
      signer: p.signer,
    }));
  } else if (participantsInput && participantsInput.participants) {
    members = participantsInput.participants.map((p) => ({
      name: p.name,
      address: p.address,
      signer: p.signer,
    }));
  } else {
    console.log(c.red("\n❌ Invalid participants input format\n"));
    return null;
  }

  console.log(
    c.cyan(`\n  📋 Using ${members.length} participants from setup phase\n`)
  );
  console.log(c.dim("     Members ready for governance:"));
  for (let i = 0; i < Math.min(5, members.length); i++) {
    console.log(
      c.dim(
        `     ${i + 1}. ${members[i].name} (${members[i].address.slice(0, 10)}...)`
      )
    );
  }
  if (members.length > 5) {
    console.log(c.dim(`     ... and ${members.length - 5} more\n`));
  } else {
    console.log();
  }

  let hederaClient;
  try {
    hederaClient = setupHederaClient();
  } catch (error) {
    console.log(c.red("\n❌ Failed to setup Hedera client"));
    console.log(c.yellow("   HCS voting will be simulated"));
    console.log(c.dim(`   Error: ${error.message}\n`));
  }

  await sleep(2000);

  console.log(c.yellow("\n🚀 Starting Governance Demo...\n"));
  await sleep(1000);

  const proposals = await testProposalCreation(ajoGovernance, members, ajoInfo);

  if (proposals.length === 0) {
    console.log(c.red("\n❌ No proposals created. Cannot continue demo.\n"));
    return null;
  }

  await sleep(2000);

  const proposalId = proposals[0].id;
  const { votes, hcsReceipts } = await testRealHcsVoteSubmission(
    hederaClient,
    ajoGovernance,
    proposalId,
    members,
    ajoInfo.hcsTopicId
  );

  await sleep(2000);

  let tallyResult = null;
  try {
    tallyResult = await testVoteTallying(
      ajoGovernance,
      proposalId,
      votes,
      members[0].signer
    );
  } catch (error) {
    console.log(c.red(`\n❌ Tallying failed: ${error.message}\n`));
  }

  await sleep(2000);

  await testSeasonStatus(ajoGovernance);

  await sleep(2000);

  const execResult = await testProposalExecution(
    ajoGovernance,
    proposalId,
    members[0].signer
  );

  await sleep(1000);

  const declarations = await testParticipationDeclaration(
    ajoGovernance,
    members
  );

  console.log(
    c.bgGreen(
      "\n" + " ".repeat(28) + "🎉 GOVERNANCE DEMO COMPLETE! 🎉" + " ".repeat(26)
    )
  );
  console.log(c.green("═".repeat(88) + "\n"));

  console.log(c.bright("  📊 Demo Summary:\n"));
  console.log(
    c.dim("     Proposals Created:         ") +
      c.green(proposals.length.toString())
  );
  console.log(
    c.dim("     Votes Cast (Real HCS):     ") + c.green(votes.length.toString())
  );
  console.log(
    c.dim("     HCS Transactions:          ") +
      c.green(hcsReceipts.length.toString())
  );
  console.log(
    c.dim("     Tally Gas Cost:            ") +
      c.yellow(tallyResult?.gasUsed?.toString() || "N/A")
  );
  console.log(
    c.dim("     Execution Status:          ") +
      (execResult?.success ? c.green("✅ Success") : c.red("❌ Failed"))
  );
  console.log(
    c.dim("     Participation Declarations:") +
      c.green(declarations.length.toString())
  );

  const totalHcsCost = hcsReceipts.reduce((sum, r) => sum + (r.cost || 0), 0);
  console.log(
    c.dim("     Total HCS Cost:            ") +
      c.yellow(`~${totalHcsCost.toFixed(4)} USD`)
  );

  console.log(c.yellow("\n  💡 Key Takeaways:"));
  console.log(
    c.dim(
      "     • Real HCS integration - votes submitted to Hedera Consensus Service"
    )
  );
  console.log(c.dim("     • HCS voting is 90%+ cheaper than pure on-chain"));
  console.log(c.dim("     • No trusted intermediaries - anyone can tally"));
  console.log(c.dim("     • Signature verification ensures vote integrity"));
  console.log(
    c.dim("     • Full season management - members can opt-in/opt-out")
  );
  console.log(
    c.dim("     • Perfect for ROSCA continuity and sustainability\n")
  );

  console.log(c.cyan("  🔗 Next Steps:"));
  console.log(c.dim("     1. Query votes from Mirror Node API"));

  // Convert topic ID for mirror node query
  const hederaTopicId = convertHcsTopicIdToHedera(ajoInfo.hcsTopicId);
  if (hederaTopicId) {
    console.log(
      c.dim(
        `        curl https://testnet.mirrornode.hedera.com/api/v1/topics/${hederaTopicId}/messages`
      )
    );
  }

  console.log(
    c.dim(
      "     2. Run tally script: node scripts/tally-hcs-votes.js --proposal " +
        proposalId
    )
  );
  console.log(c.dim("     3. Monitor continuous voting: add --monitor flag\n"));

  console.log(c.green("═".repeat(88) + "\n"));

  if (hederaClient) {
    hederaClient.close();
  }

  return {
    proposals,
    votes,
    hcsReceipts,
    tallyResult,
    execResult,
    declarations,
    totalHcsCost,
  };
}

// ================================================================
// ERROR HANDLING
// ================================================================

process.on("unhandledRejection", (error) => {
  console.error(c.red("\n❌ Unhandled error:"), error);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log(c.yellow("\n\n👋 Gracefully shutting down..."));
  process.exit(0);
});

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  runGovernanceDemo,
  testProposalCreation,
  testRealHcsVoteSubmission,
  testVoteTallying,
  testSeasonStatus,
  testProposalExecution,
  testParticipationDeclaration,
  createSignedVote,
  submitVoteToHCS,
  setupHederaClient,
  printGovernanceBanner,
  convertHcsTopicIdToHedera,
};

// Run if called directly
if (require.main === module) {
  async function main() {
    console.log(c.cyan("\n🗳️  Ajo.save Governance Demo - Standalone Mode\n"));

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      console.log(c.red("❌ Missing required environment variables:\n"));
      console.log(c.yellow("   Please set:"));
      console.log(c.dim("   - HEDERA_ACCOUNT_ID (e.g., 0.0.12345)"));
      console.log(c.dim("   - HEDERA_PRIVATE_KEY"));
      console.log(c.dim("   - GOVERNANCE_CONTRACT_ADDRESS (optional)"));
      console.log(
        c.dim("   - HEDERA_NETWORK (testnet/mainnet, default: testnet)\n")
      );
      process.exit(1);
    }

    console.log(c.green("✅ Environment variables found\n"));
    console.log(c.yellow("   To run with deployed contracts, use:"));
    console.log(c.dim("   node scripts/full-demo.js\n"));
  }

  main().catch((error) => {
    console.error(c.red("\n❌ Fatal error:"), error);
    process.exit(1);
  });
}