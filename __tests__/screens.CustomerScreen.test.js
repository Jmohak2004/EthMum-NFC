import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CustomerScreen from '../src/screens/CustomerScreen';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { useAppKit, useAccount } from '@reown/appkit-react-native';

const mockPaymentData = {
    version: 1,
    merchant: 'TestShop',
    amount: '50',
    token: 'USDC',
    decimals: 6,
    chain: 'sepolia',
    chainId: '0xaa36a7',
    timestamp: '2026-03-14T00:00:00.000Z',
    ens: 'vitalik.eth'
};

const mockStringifiedPayload = JSON.stringify(mockPaymentData);

describe('CustomerScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders initial state and starts scanning NFC automatically', async () => {
        // Tag returns null initially
        NfcManager.getTag.mockResolvedValueOnce(null);

        const { getByText } = render(<CustomerScreen />);

        expect(getByText('Customer')).toBeTruthy();

        await waitFor(() => {
            expect(NfcManager.requestTechnology).toHaveBeenCalledWith('Ndef');
            expect(getByText('Tap NFC tag or scan QR')).toBeTruthy();
        });
    });

    it('processes NFC payload and displays payment card', async () => {
        // Mock NFC tag read with payload
        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const { getByText, queryByText } = render(<CustomerScreen />);

        await waitFor(() => {
            expect(getByText('Payment Request Received')).toBeTruthy();
            expect(getByText('TestShop')).toBeTruthy();
            expect(getByText('vitalik.eth')).toBeTruthy();
            expect(getByText('50')).toBeTruthy();
            expect(getByText('USDC')).toBeTruthy();
        });
    });

    it('opens QR scanner when Scan QR is pressed', async () => {
        NfcManager.getTag.mockResolvedValueOnce(null);
        const { getByText } = render(<CustomerScreen />);

        await waitFor(() => {
            fireEvent.press(getByText('Scan QR Code'));
        });

        expect(getByText('Cancel')).toBeTruthy(); // The scanner cancel button
    });

    it('triggers WalletConnect modal when Connect Wallet is pressed', async () => {
        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const mockOpen = jest.fn();
        useAppKit.mockReturnValue({ open: mockOpen, close: jest.fn() });

        const { getByText } = render(<CustomerScreen />);

        await waitFor(() => {
            expect(getByText('Connect Wallet (Rainbow, MetaMask...)')).toBeTruthy();
        });

        fireEvent.press(getByText('Connect Wallet (Rainbow, MetaMask...)'));
        expect(mockOpen).toHaveBeenCalled();
    });

    it('executes transaction fallback if unauthenticated', async () => {
        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const { getByText } = render(<CustomerScreen />);

        await waitFor(() => {
            expect(getByText('Confirm & Pay')).toBeTruthy();
        });

        fireEvent.press(getByText('Confirm & Pay'));

        await waitFor(() => {
            // Transaction Confirmed state
            expect(getByText('Transaction Confirmed')).toBeTruthy();
            expect(getByText('View on Sepolia Explorer')).toBeTruthy();
        });
    });

    it('executes external provider chain interaction if authenticated', async () => {
        useAccount.mockReturnValueOnce({ address: '0xMockConnectedWallet', isConnected: true });

        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const { getByText } = render(<CustomerScreen />);

        await waitFor(() => {
            expect(getByText('Confirm & Pay')).toBeTruthy();
        });

        fireEvent.press(getByText('Confirm & Pay'));

        await waitFor(() => {
            expect(getByText('Transaction Confirmed')).toBeTruthy();
        });
    });
});
