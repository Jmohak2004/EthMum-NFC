import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';

// ─── AsyncStorage Mock ──────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
}));

// ─── NFC Manager Mock ───────────────────────────────────────────────────
jest.mock('react-native-nfc-manager', () => {
    return {
        __esModule: true,
        default: {
            start: jest.fn().mockResolvedValue(),
            isSupported: jest.fn().mockResolvedValue(true),
            requestTechnology: jest.fn().mockResolvedValue(),
            cancelTechnologyRequest: jest.fn().mockResolvedValue(),
            getTag: jest.fn().mockResolvedValue(null),
            writeNdefMessage: jest.fn().mockResolvedValue(),
            NfcTech: { Ndef: 'Ndef' }
        },
        Ndef: {
            textRecord: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
            encodeMessage: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
            text: {
                decodePayload: jest.fn().mockReturnValue('{}'),
            }
        }
    };
});

// ─── Expo Camera Mock ───────────────────────────────────────────────────
jest.mock('expo-camera', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        CameraView: (props) => React.createElement(View, props),
        useCameraPermissions: jest.fn().mockReturnValue([{ granted: true }, jest.fn()])
    };
});

// ─── AppKit & WalletConnect Mock ────────────────────────────────────────
jest.mock('@reown/appkit-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    // Mock the specific wallet provider behavior expected by ethers BrowserProvider
    const mockWalletProvider = {
        request: jest.fn().mockResolvedValue('0xMockTxHash')
    };

    return {
        AppKitProvider: ({ children }) => React.createElement(View, null, children),
        AppKit: () => React.createElement(View, null),
        useAppKit: jest.fn().mockReturnValue({ open: jest.fn(), close: jest.fn() }),
        useAccount: jest.fn().mockReturnValue({ address: '0xMockConnectedWallet', isConnected: false }),
        useProvider: jest.fn().mockReturnValue({ provider: mockWalletProvider }),
        createAppKit: jest.fn().mockReturnValue({})
    };
});

jest.mock('@reown/appkit-ethers-react-native', () => ({
    EthersAdapter: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@walletconnect/react-native-compat', () => ({}));

// ─── Expo Vector Icons Mock ─────────────────────────────────────────────
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        Ionicons: (props) => React.createElement(View, props)
    };
});

// ─── Ethers Mock ────────────────────────────────────────────────────────
jest.mock('ethers', () => {
    const actualEthers = jest.requireActual('ethers');

    // Mock Wallet behavior
    const mockWalletInstance = {
        address: '0xDemoWalletAddress',
        provider: {
            getBalance: jest.fn().mockResolvedValue(actualEthers.parseEther('10.0'))
        },
        sendTransaction: jest.fn().mockResolvedValue({
            hash: '0xMockTxHash',
            from: '0xDemoWalletAddress',
            to: '0xRecipientAddress',
            wait: jest.fn().mockResolvedValue({ blockNumber: 1234 })
        })
    };

    // Mock Contract behavior (for USDC)
    const mockContractInstance = {
        decimals: jest.fn().mockResolvedValue(6n),
        balanceOf: jest.fn().mockResolvedValue(actualEthers.parseUnits('100', 6)),
        transfer: jest.fn().mockResolvedValue({
            hash: '0xMockUSDCHash',
            wait: jest.fn().mockResolvedValue({ blockNumber: 1234 })
        })
    };
    mockContractInstance.transfer.estimateGas = jest.fn().mockResolvedValue(100000n);

    // Mock BrowserProvider/Signer
    const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0xMockConnectedWallet'),
        sendTransaction: jest.fn().mockResolvedValue({
            hash: '0xMockWalletConnectTxHash',
            from: '0xMockConnectedWallet',
            to: '0xRecipientAddress',
            wait: jest.fn().mockResolvedValue({ blockNumber: 5678 })
        })
    };

    const BrowserProviderMock = jest.fn().mockImplementation(() => ({
        getNetwork: jest.fn().mockResolvedValue({ chainId: 84532n }), // Base Sepolia
        getSigner: jest.fn().mockResolvedValue(mockSigner)
    }));

    const JsonRpcProviderMock = jest.fn().mockImplementation(() => ({
        resolveName: jest.fn().mockResolvedValue('0xResolvedENSAddress'),
        lookupAddress: jest.fn().mockResolvedValue('resolved.eth'),
        getAvatar: jest.fn().mockResolvedValue('https://avatar.link'),
        getResolver: jest.fn().mockResolvedValue({
            getText: jest.fn().mockResolvedValue('Mock record')
        })
    }));

    const WalletMock = jest.fn().mockImplementation(() => mockWalletInstance);
    const ContractMock = jest.fn().mockImplementation(() => mockContractInstance);

    // Build exports — also set the `ethers` namespace so
    // `import { ethers } from 'ethers'` picks up mocked constructors
    const mockedExports = {
        ...actualEthers,
        Wallet: WalletMock,
        Contract: ContractMock,
        BrowserProvider: BrowserProviderMock,
        JsonRpcProvider: JsonRpcProviderMock,
    };

    // The `ethers` named export is a namespace containing all exports.
    // Override it so `ethers.JsonRpcProvider` etc. use the mocks.
    mockedExports.ethers = mockedExports;

    return mockedExports;
});

// Mock environment variables directly instead of relying on babel dotenv transform
jest.mock('@env', () => ({
    DEMO_PRIVATE_KEY: 'mock_pk',
    SEPOLIA_RPC_URL: 'https://rpc.sepolia.org',
    WALLETCONNECT_PROJECT_ID: 'mock_wc_id',
    USDC_CONTRACT: '0xmockUSDC'
}), { virtual: true });

// Suppress console.warn during tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn()
};
