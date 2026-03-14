import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CustomerScreen from '../src/screens/CustomerScreen';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { Alert } from 'react-native';
import { useAppKit, useAccount } from '@reown/appkit-react-native';

const mockPaymentData = {
    version: 2,
    mode: 'receive-profile',
    receiverName: 'Person B',
    suggestedAmount: '50',
    preferredToken: 'USDC',
    decimals: 6,
    preferredChain: 'base-sepolia',
    chainId: '0x14a34',
    timestamp: '2026-03-14T00:00:00.000Z',
    ens: 'vitalik.eth',
    wallet: '0x1234567890123456789012345678901234567890',
};

const mockStringifiedPayload = JSON.stringify(mockPaymentData);

jest.spyOn(Alert, 'alert');

describe('CustomerScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAccount.mockReturnValue({
            address: '0xMockConnectedWallet',
            isConnected: true,
        });
    });

    it('renders strict send flow and does not auto-scan before user action', async () => {
        const { getByText } = render(<CustomerScreen />);

        expect(getByText('Send')).toBeTruthy();
        expect(getByText('Strict flow: connect wallet, tap receiver, then confirm transaction.')).toBeTruthy();
        expect(getByText('Tap Person B phone or scan QR')).toBeTruthy();
        expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
    });

    it('processes NFC payload and displays receiver details after NFC read action', async () => {
        // Mock NFC tag read with payload
        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const { getByText } = render(<CustomerScreen />);

        fireEvent.press(getByText('Read Receiver via NFC'));

        await waitFor(() => {
            expect(getByText('Receiver Profile Received')).toBeTruthy();
            expect(getByText('Person B')).toBeTruthy();
            expect(getByText('vitalik.eth')).toBeTruthy();
            expect(getByText('50')).toBeTruthy();
            expect(getByText('USDC')).toBeTruthy();
        });
    });

    it('opens QR scanner when Scan QR is pressed', async () => {
        const { getByText } = render(<CustomerScreen />);

        fireEvent.press(getByText('Scan QR Code'));

        expect(getByText('Cancel')).toBeTruthy(); // The scanner cancel button
    });

    it('shows connect CTA and opens WalletConnect modal when disconnected', async () => {
        useAccount.mockReturnValueOnce({ address: null, isConnected: false });
        const mockOpen = jest.fn();
        useAppKit.mockReturnValue({ open: mockOpen, close: jest.fn() });

        const { getByText } = render(<CustomerScreen />);

        expect(getByText('Connect Wallet to Start')).toBeTruthy();

        fireEvent.press(getByText('Connect Wallet to Start'));
        expect(mockOpen).toHaveBeenCalled();
    });

    it('executes connected-wallet transaction flow after user confirmation', async () => {
        Ndef.text.decodePayload.mockReturnValueOnce(mockStringifiedPayload);
        NfcManager.getTag.mockResolvedValueOnce({
            ndefMessage: [{ payload: [1, 2, 3] }]
        });

        const { getByText } = render(<CustomerScreen />);

        fireEvent.press(getByText('Read Receiver via NFC'));

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

        fireEvent.press(getByText('Confirm & Send'));

        expect(Alert.alert).toHaveBeenCalledWith(
            'Confirm Transaction',
            expect.any(String),
            expect.any(Array)
        );

        const confirmButtons = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];
        const confirmAction = confirmButtons.find((button) => button.text === 'Confirm');
        confirmAction.onPress();

        await waitFor(() => {
            expect(getByText('Transfer Confirmed')).toBeTruthy();
            expect(getByText('View on Base Explorer')).toBeTruthy();
        });
    });
});
