import { ethers } from 'ethers';
import {
    sendETH, sendUSDC, resolveENS, resolveENSProfile,
    ensureCorrectChain, sendETHViaProvider, sendUSDCViaProvider
} from '../src/utils/wallet';

// Process.env relies on the babel dotenv plugin in this codebase,
// we ensure DEMO_PRIVATE_KEY exists for testing getDemoWallet
process.env.DEMO_PRIVATE_KEY = 'mock_pk';

describe('wallet.js Blockchain Utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ENS Operations', () => {
        it('resolves an ENS name to an address', async () => {
            const address = await resolveENS('test.eth');
            expect(address).toBe('0xResolvedENSAddress');
        });

        it('resolves an ENS profile with avatar and text records', async () => {
            const profile = await resolveENSProfile('test.eth');
            expect(profile.ensName).toBe('test.eth');
            expect(profile.address).toBe('0xResolvedENSAddress');
            expect(profile.avatar).toBe('https://avatar.link');
            expect(profile.textRecords).toBeDefined();
        });
    });

    describe('Demo Wallet Operations', () => {
        it('sends ETH using the demo wallet fallback', async () => {
            const result = await sendETH('0xRecipientAddress', '1.0', 'sepolia');
            expect(result.hash).toBe('0xMockTxHash');
            expect(result.token).toBe('ETH');
            expect(result.amount).toBe('1.0');
        });

        it('sends USDC using the demo wallet fallback', async () => {
            const result = await sendUSDC('0xRecipientAddress', '10', 'sepolia');
            expect(result.hash).toBe('0xMockUSDCHash');
            expect(result.token).toBe('USDC');
            expect(result.amount).toBe('10');
        });
    });

    describe('External Provider / WalletConnect Operations', () => {
        const mockWalletProvider = { request: jest.fn().mockResolvedValue() };

        it('ensures correct chain by requesting network switch', async () => {
            await ensureCorrectChain(mockWalletProvider, 'sepolia');
            // Mock BrowserProvider returns chainId 84532 so it matches natively in our tests.
            // If it matches, switch doesn't get called.
            expect(mockWalletProvider.request).not.toHaveBeenCalled();
        });

        it('sends ETH via connected wallet provider', async () => {
            const result = await sendETHViaProvider(mockWalletProvider, '0xRecipientAddress', '1.0', 'sepolia');
            expect(result.hash).toBe('0xMockWalletConnectTxHash');
        });

        it('sends USDC via connected wallet provider', async () => {
            const result = await sendUSDCViaProvider(mockWalletProvider, '0xRecipientAddress', '10', 'sepolia');
            expect(result.hash).toBe('0xMockUSDCHash');
        });
    });
});
