/**
 * Console Output Formatting Utilities
 * 
 * This module provides utilities for colored console output, formatted tables,
 * banners, and other display helpers for the Starknet integration scripts.
 */

/**
 * ANSI color codes for terminal output
 */
export const colors = {
  // Basic colors
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  white: (text) => `\x1b[37m${text}\x1b[0m`,
  
  // Styles
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`,
  underscore: (text) => `\x1b[4m${text}\x1b[0m`,
  blink: (text) => `\x1b[5m${text}\x1b[0m`,
  reverse: (text) => `\x1b[7m${text}\x1b[0m`,
  hidden: (text) => `\x1b[8m${text}\x1b[0m`,
  
  // Background colors
  bgBlack: (text) => `\x1b[40m${text}\x1b[0m`,
  bgRed: (text) => `\x1b[41m${text}\x1b[0m`,
  bgGreen: (text) => `\x1b[42m${text}\x1b[0m`,
  bgYellow: (text) => `\x1b[43m${text}\x1b[0m`,
  bgBlue: (text) => `\x1b[44m${text}\x1b[0m`,
  bgMagenta: (text) => `\x1b[45m${text}\x1b[0m`,
  bgCyan: (text) => `\x1b[46m${text}\x1b[0m`,
  bgWhite: (text) => `\x1b[47m${text}\x1b[0m`,
  
  // Reset
  reset: '\x1b[0m'
};

/**
 * Format USDC amount (6 decimals)
 * @param {string|number|bigint} amount - Amount in smallest unit (micro USDC)
 * @param {number} decimals - Number of decimals (default: 6 for USDC)
 * @returns {string} Formatted amount with 2 decimal places
 */
export function formatUSDC(amount, decimals = 6) {
  if (amount === null || amount === undefined) return '0.00';
  
  const divisor = Math.pow(10, decimals);
  const value = Number(amount) / divisor;
  
  return value.toFixed(2);
}

/**
 * Format token amount with custom decimals
 * @param {string|number|bigint} amount - Amount in smallest unit
 * @param {number} decimals - Number of decimals
 * @param {number} displayDecimals - Number of decimals to display
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
  if (amount === null || amount === undefined) return '0';
  
  const divisor = Math.pow(10, decimals);
  const value = Number(amount) / divisor;
  
  return value.toFixed(displayDecimals);
}

/**
 * Format large numbers with commas
 * @param {string|number} num - Number to format
 * @returns {string} Formatted number with commas
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  
  return Number(num).toLocaleString('en-US');
}

/**
 * Print a decorative banner
 * @param {string} title - Banner title
 * @param {number} width - Banner width (default: 88)
 */
export function printBanner(title, width = 88) {
  const border = '═'.repeat(width);
  const padding = Math.floor((width - title.length - 2) / 2);
  const titleLine = '║' + ' '.repeat(padding) + title + ' '.repeat(width - padding - title.length - 2) + '║';
  
  console.log(colors.magenta('\n' + border));
  console.log(colors.cyan(titleLine));
  console.log(colors.magenta(border + '\n'));
}

/**
 * Print a simple section header
 * @param {string} title - Section title
 */
export function printSection(title) {
  console.log(colors.cyan(`\n  ${title}`));
  console.log(colors.dim('  ' + '─'.repeat(title.length)));
}

/**
 * Print a formatted table
 * @param {Array<string>} headers - Table headers
 * @param {Array<Array<string>>} rows - Table rows
 * @param {object} options - Formatting options
 */
export function printTable(headers, rows, options = {}) {
  const {
    columnWidths = null,
    alignment = 'left',
    showBorder = true,
    indent = '  '
  } = options;
  
  // Calculate column widths if not provided
  const widths = columnWidths || calculateColumnWidths(headers, rows);
  
  // Print top border
  if (showBorder) {
    printTableBorder(widths, 'top', indent);
  }
  
  // Print headers
  printTableRow(headers, widths, alignment, indent);
  
  // Print header separator
  if (showBorder) {
    printTableBorder(widths, 'middle', indent);
  }
  
  // Print rows
  rows.forEach(row => {
    printTableRow(row, widths, alignment, indent);
  });
  
  // Print bottom border
  if (showBorder) {
    printTableBorder(widths, 'bottom', indent);
  }
}

/**
 * Calculate column widths based on content
 * @param {Array<string>} headers - Table headers
 * @param {Array<Array<string>>} rows - Table rows
 * @returns {Array<number>} Column widths
 */
function calculateColumnWidths(headers, rows) {
  const widths = headers.map(h => stripAnsi(h).length);
  
  rows.forEach(row => {
    row.forEach((cell, i) => {
      const cellLength = stripAnsi(String(cell)).length;
      if (cellLength > widths[i]) {
        widths[i] = cellLength;
      }
    });
  });
  
  return widths;
}

/**
 * Print table border
 * @param {Array<number>} widths - Column widths
 * @param {string} position - Border position ('top', 'middle', 'bottom')
 * @param {string} indent - Indentation
 */
function printTableBorder(widths, position, indent) {
  let left, middle, right, line;
  
  switch (position) {
    case 'top':
      left = '┌';
      middle = '┬';
      right = '┐';
      line = '─';
      break;
    case 'middle':
      left = '├';
      middle = '┼';
      right = '┤';
      line = '─';
      break;
    case 'bottom':
      left = '└';
      middle = '┴';
      right = '┘';
      line = '─';
      break;
  }
  
  const parts = widths.map(w => line.repeat(w + 2));
  const border = left + parts.join(middle) + right;
  
  console.log(colors.dim(indent + border));
}

/**
 * Print table row
 * @param {Array<string>} cells - Row cells
 * @param {Array<number>} widths - Column widths
 * @param {string} alignment - Text alignment
 * @param {string} indent - Indentation
 */
function printTableRow(cells, widths, alignment, indent) {
  const paddedCells = cells.map((cell, i) => {
    const cellStr = String(cell);
    const cellLength = stripAnsi(cellStr).length;
    const padding = widths[i] - cellLength;
    
    if (alignment === 'right') {
      return ' '.repeat(padding) + cellStr;
    } else if (alignment === 'center') {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + cellStr + ' '.repeat(rightPad);
    } else {
      return cellStr + ' '.repeat(padding);
    }
  });
  
  const row = '│ ' + paddedCells.join(' │ ') + ' │';
  console.log(colors.dim(indent + row));
}

/**
 * Strip ANSI color codes from string
 * @param {string} str - String with ANSI codes
 * @returns {string} String without ANSI codes
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Print a success message
 * @param {string} message - Success message
 */
export function printSuccess(message) {
  console.log(colors.green(`  ✅ ${message}`));
}

/**
 * Print an error message
 * @param {string} message - Error message
 */
export function printError(message) {
  console.log(colors.red(`  ❌ ${message}`));
}

/**
 * Print a warning message
 * @param {string} message - Warning message
 */
export function printWarning(message) {
  console.log(colors.yellow(`  ⚠️  ${message}`));
}

/**
 * Print an info message
 * @param {string} message - Info message
 */
export function printInfo(message) {
  console.log(colors.cyan(`  ℹ️  ${message}`));
}

/**
 * Print a progress message
 * @param {string} message - Progress message
 */
export function printProgress(message) {
  console.log(colors.dim(`  ⏳ ${message}`));
}

/**
 * Print a step message
 * @param {number} step - Step number
 * @param {string} message - Step message
 */
export function printStep(step, message) {
  console.log(colors.cyan(`\n  📋 Step ${step}: ${message}`));
}

/**
 * Print transaction details
 * @param {string} txHash - Transaction hash
 * @param {string} explorerUrl - Explorer URL
 */
export function printTransaction(txHash, explorerUrl) {
  console.log(colors.dim(`  Transaction: ${txHash}`));
  if (explorerUrl) {
    console.log(colors.dim(`  Explorer: ${explorerUrl}`));
  }
}

/**
 * Print a divider line
 * @param {number} width - Divider width
 * @param {string} char - Character to use
 */
export function printDivider(width = 88, char = '─') {
  console.log(colors.dim('  ' + char.repeat(width - 2)));
}

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, decimals = 2) {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format duration in milliseconds to human readable
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Create a progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} width - Bar width
 * @returns {string} Progress bar string
 */
export function createProgressBar(current, total, width = 40) {
  const percentage = current / total;
  const filled = Math.floor(percentage * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = formatPercentage(percentage);
  
  return `${bar} ${percent}`;
}

/**
 * Print a key-value pair
 * @param {string} key - Key name
 * @param {string} value - Value
 * @param {number} keyWidth - Width for key column
 */
export function printKeyValue(key, value, keyWidth = 20) {
  const paddedKey = key.padEnd(keyWidth);
  console.log(colors.dim(`  ${paddedKey}: `) + value);
}

/**
 * Print a list of items
 * @param {Array<string>} items - List items
 * @param {string} bullet - Bullet character
 */
export function printList(items, bullet = '•') {
  items.forEach(item => {
    console.log(colors.dim(`  ${bullet} ${item}`));
  });
}
