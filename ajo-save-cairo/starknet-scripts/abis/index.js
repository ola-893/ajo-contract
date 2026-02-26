/**
 * Contract ABIs for Ajo Cairo contracts
 * 
 * This module exports all contract ABIs for easy importing in scripts.
 * 
 * Usage:
 *   import { FACTORY_ABI, CORE_ABI, ERC20_ABI } from './abis/index.js';
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load ABI from JSON file
 * @param {string} filename - Name of the ABI file
 * @returns {Array} Parsed ABI array
 */
function loadAbi(filename) {
  const path = join(__dirname, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

// Export all ABIs
export const FACTORY_ABI = loadAbi('factory.json');
export const CORE_ABI = loadAbi('core.json');
export const MEMBERS_ABI = loadAbi('members.json');
export const COLLATERAL_ABI = loadAbi('collateral.json');
export const PAYMENTS_ABI = loadAbi('payments.json');
export const GOVERNANCE_ABI = loadAbi('governance.json');
export const SCHEDULE_ABI = loadAbi('schedule.json');
export const ERC20_ABI = loadAbi('erc20.json');

// Export as ABIS object for convenience
export const ABIS = {
  FACTORY_ABI,
  CORE_ABI,
  MEMBERS_ABI,
  COLLATERAL_ABI,
  PAYMENTS_ABI,
  GOVERNANCE_ABI,
  SCHEDULE_ABI,
  ERC20_ABI
};

// Export as default object for convenience
export default ABIS;
