# Contract ABIs

This directory contains the Application Binary Interface (ABI) files for all Ajo Cairo contracts deployed on Starknet.

## Files

- **factory.json** - AjoFactory contract ABI
- **core.json** - AjoCore contract ABI
- **members.json** - AjoMembers contract ABI
- **collateral.json** - AjoCollateral contract ABI
- **payments.json** - AjoPayments contract ABI
- **governance.json** - AjoGovernance contract ABI
- **schedule.json** - AjoSchedule contract ABI
- **erc20.json** - Standard ERC20 token ABI (for USDC interactions)

## Source

These ABIs were extracted from the compiled Cairo contracts in `ajo-save-cairo/target/dev/` using the following command:

```bash
cat ajo-save-cairo/target/dev/ajo_save_<ContractName>.contract_class.json | jq '.abi' > starknet-scripts/abis/<contract>.json
```

## Usage

Import these ABIs in your JavaScript/TypeScript scripts to interact with the deployed contracts:

```javascript
import { Contract } from 'starknet';
import factoryAbi from './abis/factory.json' assert { type: 'json' };

const factoryContract = new Contract(
  factoryAbi,
  factoryAddress,
  provider
);
```

## Updating ABIs

If the Cairo contracts are modified and recompiled, regenerate the ABIs by:

1. Rebuild the Cairo contracts: `cd ajo-save-cairo && scarb build`
2. Re-extract the ABIs using the command above
3. Verify the ABI structure matches the expected format

## ABI Format

These ABIs follow the Cairo 1.0 ABI format, which includes:
- Interface implementations
- Function definitions with inputs/outputs
- Event definitions
- Struct definitions
- Enum definitions

Each function entry includes:
- `type`: "function", "constructor", "l1_handler", etc.
- `name`: Function name
- `inputs`: Array of input parameters
- `outputs`: Array of output parameters
- `state_mutability`: "view" or "external"
