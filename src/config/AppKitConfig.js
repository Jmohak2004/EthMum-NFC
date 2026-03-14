// ─── WalletConnect / Reown AppKit Config ─────────────────────────────
// IMPORTANT: @walletconnect/react-native-compat MUST be imported before
// any other AppKit imports. It sets up polyfills required by WalletConnect.
import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WALLETCONNECT_PROJECT_ID } from '@env';

// Adapter: AsyncStorage → AppKit Storage interface
const appKitStorage = {
    async getKeys() {
        const keys = await AsyncStorage.getAllKeys();
        return [...keys];
    },
    async getEntries() {
        const keys = await AsyncStorage.getAllKeys();
        if (!keys.length) return [];
        const pairs = await AsyncStorage.multiGet(keys);
        return pairs.map(([k, v]) => {
            try { return [k, JSON.parse(v)]; } catch { return [k, v]; }
        });
    },
    async getItem(key) {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null || raw === undefined) return undefined;
        try { return JSON.parse(raw); } catch { return raw; }
    },
    async setItem(key, value) {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    },
    async removeItem(key) {
        await AsyncStorage.removeItem(key);
    },
};

// Sepolia chain definition
const sepolia = {
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.sepolia.org'] },
    },
    blockExplorers: {
        default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
    },
    testnet: true,
};

// Base Sepolia chain definition
const baseSepolia = {
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
    },
    blockExplorers: {
        default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
    },
    testnet: true,
};

// Ethers adapter for EVM chain interactions
const ethersAdapter = new EthersAdapter();

const projectId = WALLETCONNECT_PROJECT_ID || 'your_project_id';

// Create and export the AppKit instance
export const appKit = createAppKit({
    projectId,
    networks: [baseSepolia, sepolia],
    defaultNetwork: baseSepolia,
    adapters: [ethersAdapter],
    storage: appKitStorage,
    metadata: {
        name: 'EthMum NFC Pay',
        description: 'Pay merchants via NFC & QR — powered by WalletConnect',
        url: 'https://ethmum.app',
        icons: ['https://ethmum.app/icon.png'],
        redirect: {
            native: 'ethmum://',
        },
    },
    features: {
        email: false,
        socials: false,
    },
});
