# Cairo Contract ABIs

This directory will contain the ABIs for the Cairo smart contracts once they are ready.

## Expected Contracts:

- **ajoFactory.json** - Factory contract for creating new Ajo groups
- **ajoCore.json** - Main Ajo logic contract
- **ajoMembers.json** - Member management contract
- **ajoPayments.json** - Payment processing contract
- **ajoGovernance.json** - Governance and voting contract
- **ajoCollateral.json** - Collateral management contract
- **erc20.json** - ERC20 token interface for USDC/other tokens

## Cairo Contract Structure

Once the backend dev provides the Cairo contracts, place the compiled ABIs here.
The ABIs should be in JSON format compatible with starknet.js.

### Example Structure:
```json
{
  "abi": [
    {
      "type": "function",
      "name": "function_name",
      "inputs": [...],
      "outputs": [...],
      "state_mutability": "view"
    }
  ]
}
```
