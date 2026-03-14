// ─── Blockchain Configuration ────────────────────────────────────────
// Non-secret config lives here. Secrets (private keys, API keys) stay in .env

// ─── Chain Definitions ──────────────────────────────────────────────
export const CHAINS = {
    sepolia: {
        key: 'sepolia',
        chainId: 11155111,
        hexChainId: '0xaa36a7',
        name: 'Sepolia',
        rpcUrl: 'https://rpc.sepolia.org',
        nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        explorer: {
            baseUrl: 'https://sepolia.etherscan.io',
            tx: (hash) => `https://sepolia.etherscan.io/tx/${hash}`,
            address: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
        },
    },
    'base-sepolia': {
        key: 'base-sepolia',
        chainId: 84532,
        hexChainId: '0x14a34',
        name: 'Base Sepolia',
        rpcUrl: 'https://sepolia.base.org',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        explorer: {
            baseUrl: 'https://sepolia.basescan.org',
            tx: (hash) => `https://sepolia.basescan.org/tx/${hash}`,
            address: (addr) => `https://sepolia.basescan.org/address/${addr}`,
        },
    },
};

export const CHAIN_KEYS = Object.keys(CHAINS);
export const DEFAULT_CHAIN = 'base-sepolia';

// Legacy compat — used by MerchantScreen default
export const NETWORK = DEFAULT_CHAIN;

// ─── Helpers ────────────────────────────────────────────────────────
export function getChainConfig(chainKey) {
    return CHAINS[chainKey] || CHAINS[DEFAULT_CHAIN];
}

export function getExplorerUrl(chainKey, txHash) {
    const chain = getChainConfig(chainKey);
    return chain.explorer.tx(txHash);
}

export function getUSDCAddress(chainKey) {
    return getChainConfig(chainKey).usdc;
}

// Legacy — kept for backward compat
export const CONTRACTS = {
    USDC: CHAINS[DEFAULT_CHAIN].usdc,
};

export const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
];

export const EXPLORER = CHAINS[DEFAULT_CHAIN].explorer;
