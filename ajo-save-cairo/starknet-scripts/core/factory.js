import { Contract, CairoCustomEnum } from 'starknet';
import { ABIS } from '../abis/index.js';
import { waitForTransaction } from '../utils/starknet.js';
import { colors } from '../utils/formatting.js';
import { retryWithBackoff } from '../utils/retry.js';

function toU256(v) {
  return BigInt(v);
}

function normalizePaymentToken(token) {
  const value = String(token ?? 'USDC').toUpperCase();
  return value === 'BTC'
    ? new CairoCustomEnum({ BTC: {} })
    : new CairoCustomEnum({ USDC: {} });
}

function decodeAjoInfo(info, fallbackId = 0) {
  return {
    id: Number(info?.id ?? fallbackId),
    name: info?.config?.name ?? info?.name ?? '',
    owner: info?.config?.creator ?? info?.owner ?? '',
    ajo_core: info?.core_address ?? info?.ajo_core ?? '',
    ajo_members: info?.members_address ?? info?.ajo_members ?? '',
    ajo_collateral: info?.collateral_address ?? info?.ajo_collateral ?? '',
    ajo_payments: info?.payments_address ?? info?.ajo_payments ?? '',
    ajo_governance: info?.governance_address ?? info?.ajo_governance ?? '',
    ajo_schedule: info?.schedule_address ?? info?.ajo_schedule ?? '',
    is_initialized: Boolean(info?.is_initialized ?? info?.is_active ?? false),
    raw: info
  };
}

async function executeFactoryStep(account, factory, method, args) {
  const call = factory.populate(method, args);
  const tx = await account.execute(call);
  await waitForTransaction(account.provider, tx.transaction_hash);
  return tx.transaction_hash;
}

/**
 * Get factory statistics.
 */
export async function getFactoryStats(factoryContract) {
  return await retryWithBackoff(
    async () => {
      const total = await factoryContract.get_total_ajos();
      return {
        totalCreated: Number(total ?? 0),
        activeCount: Number(total ?? 0)
      };
    },
    'Get factory stats'
  );
}

/**
 * Create and fully deploy an Ajo using phased deployment.
 * Order: members -> collateral/payments -> governance/schedule -> core.
 */
export async function createAjo(account, factoryAddress, config) {
  return await retryWithBackoff(
    async () => {
      const factory = new Contract(ABIS.FACTORY_ABI, factoryAddress, account);

      // Optional token registry updates before creating pool instances.
      if (config.usdcTokenAddress) {
        console.log(colors.dim('  ⏳ Configuring factory USDC token...'));
        await executeFactoryStep(account, factory, 'set_usdc_token_address', [
          config.usdcTokenAddress
        ]);
      }
      if (config.btcTokenAddress) {
        console.log(colors.dim('  ⏳ Configuring factory BTC token...'));
        await executeFactoryStep(account, factory, 'set_btc_token_address', [
          config.btcTokenAddress
        ]);
      }

      const name = config.name;
      const monthlyContribution = toU256(
        config.monthlyContribution ?? config.monthly_contribution ?? 50_000000
      );
      const totalParticipants = toU256(
        config.totalParticipants ?? config.total_participants ?? 10
      );
      const cycleDuration = Number(config.cycleDuration ?? config.cycle_duration ?? 2_592_000);
      const paymentToken = normalizePaymentToken(config.paymentToken ?? config.payment_token ?? 'USDC');

      console.log(colors.dim('  📝 Creating Ajo with config:'));
      console.log(colors.dim(`     Name: ${name}`));
      console.log(colors.dim(`     Monthly: ${monthlyContribution.toString()}`));
      console.log(colors.dim(`     Participants: ${totalParticipants.toString()}`));

      const beforeTotal = await factory.get_total_ajos();
      const createCall = factory.populate('create_ajo', [
        name,
        monthlyContribution,
        totalParticipants,
        cycleDuration,
        paymentToken
      ]);

      const createTx = await account.execute(createCall);
      await waitForTransaction(account.provider, createTx.transaction_hash);

      const ajoId = Number(beforeTotal) + 1;

      const deploymentSteps = [
        ['deploy_members', [ajoId]],
        ['deploy_collateral_and_payments', [ajoId]],
        ['deploy_governance_and_schedule', [ajoId]],
        ['deploy_core', [ajoId]]
      ];

      const deploymentTxs = [];
      for (const [method, args] of deploymentSteps) {
        console.log(colors.dim(`  ⏳ ${method}...`));
        const txHash = await executeFactoryStep(account, factory, method, args);
        deploymentTxs.push({ method, txHash });
      }

      return {
        ajoId,
        transactionHash: createTx.transaction_hash,
        deploymentTxs
      };
    },
    'Create Ajo'
  );
}

/**
 * Get Ajo information by ID.
 */
export async function getAjoInfo(factoryContract, ajoId) {
  return await retryWithBackoff(
    async () => {
      const info = await factoryContract.get_ajo_info(ajoId);
      return decodeAjoInfo(info, ajoId);
    },
    `Get Ajo info for ID ${ajoId}`
  );
}

/**
 * Get all Ajos from factory.
 */
export async function getAllAjos(factoryContract) {
  return await retryWithBackoff(
    async () => {
      const stats = await getFactoryStats(factoryContract);
      const ajos = [];

      for (let i = 1; i <= stats.totalCreated; i++) {
        try {
          const ajoInfo = await getAjoInfo(factoryContract, i);
          ajos.push(ajoInfo);
        } catch (error) {
          console.log(colors.yellow(`  ⚠️ Could not fetch Ajo ${i}: ${error.message}`));
        }
      }

      return ajos;
    },
    'Get all Ajos'
  );
}

/**
 * Display factory statistics.
 */
export async function displayFactoryStats(factoryContract) {
  const stats = await getFactoryStats(factoryContract);

  console.log(colors.cyan('\n  📊 Factory Statistics:'));
  console.log(colors.dim(`     Total Created: ${stats.totalCreated}`));
  console.log(colors.dim(`     Active Count:  ${stats.activeCount}`));
  console.log();
}
