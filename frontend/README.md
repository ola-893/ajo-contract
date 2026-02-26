# Ajo.Save - Decentralized Savings on Starknet

A decentralized application (dApp) that brings the traditional African savings system "Ajo" (ROSCA - Rotating Savings and Credit Association) to the Starknet blockchain.

Built for the **Re{define} Hackathon** focusing on Privacy and Bitcoin on Starknet.

## 🌟 Features

- **Create & Join Ajo Groups**: Community-based rotating savings groups
- **Smart Contract Powered**: Trustless execution via Cairo smart contracts
- **Starknet Integration**: Leveraging quantum-safe ZK technology
- **Multi-Token Support**: USDC, ETH, and other tokens
- **Governance**: Democratic decision-making for group members
- **Collateral Management**: Automated collateral handling
- **Payment Scheduling**: Automated payment cycles
- **Privacy-First**: Built with privacy-preserving technology in mind

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm or yarn
- Starknet wallet (ArgentX or Braavos browser extension)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd ajo-save

# Install dependencies (use --legacy-peer-deps if needed)
npm install --legacy-peer-deps

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Optional: WalletConnect Project ID
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id

# Network (sepolia, mainnet, devnet)
VITE_STARKNET_NETWORK=sepolia
```

## 📦 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Blockchain**: Starknet (Cairo smart contracts)
- **Wallet Integration**: starknet.js, get-starknet-core
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Routing**: React Router
- **UI Components**: Radix UI, Lucide Icons

## 🔗 Starknet Integration

This project uses Starknet for:
- **Privacy**: Zero-knowledge proofs for private transactions
- **Security**: Quantum-safe cryptography
- **Scalability**: Fast and cheap transactions
- **Bitcoin DeFi**: Building on Starknet as the Bitcoin DeFi layer

### Supported Wallets
- [ArgentX](https://www.argent.xyz/argent-x/)
- [Braavos](https://braavos.app/)

## 📚 Documentation

For detailed migration guide and setup instructions, see [STARKNET_MIGRATION.md](./STARKNET_MIGRATION.md)

## 🛠️ Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📝 Project Structure

```
src/
├── abi/              # Cairo contract ABIs (to be added)
├── components/       # React components
│   ├── header/      # Navigation components
│   ├── ui/          # UI components
│   └── ...
├── contexts/        # React contexts (Starknet wallet)
├── hooks/           # Custom React hooks (contract interactions)
├── config/          # Configuration files
├── pages/           # Page components
└── store/           # Zustand stores
```

## 🔐 Smart Contracts

**Note**: Cairo smart contracts are being developed separately by the backend team.

Once ready, add the compiled ABIs to `src/abi/` and update contract addresses in `src/abi/placeholders.ts`.

### Expected Contracts
- **AjoFactory**: Creates new Ajo groups
- **AjoCore**: Main Ajo logic
- **AjoMembers**: Member management
- **AjoPayments**: Payment processing
- **AjoGovernance**: Voting and governance
- **AjoCollateral**: Collateral management

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
