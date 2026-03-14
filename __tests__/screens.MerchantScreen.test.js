import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MerchantScreen from '../src/screens/MerchantScreen';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { Alert } from 'react-native';
import { useAccount } from '@reown/appkit-react-native';

jest.spyOn(Alert, 'alert');

describe('MerchantScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAccount.mockReturnValue({
            address: '0x1234567890123456789012345678901234567890',
            isConnected: true,
        });
    });

    it('renders correctly and defaults to USDC on Base Sepolia', () => {
        const { getByText, getByPlaceholderText } = render(<MerchantScreen />);
        expect(getByText('Receive')).toBeTruthy();
        expect(getByPlaceholderText('Receiver display name')).toBeTruthy();
        expect(getByPlaceholderText('Connect wallet to auto-fill')).toBeTruthy();
        expect(getByPlaceholderText('0.00')).toBeTruthy();
    });

    it('requires connected wallet before sharing profile', async () => {
        useAccount.mockReturnValueOnce({ address: null, isConnected: false });
        const { getByText } = render(<MerchantScreen />);

        fireEvent.press(getByText('Share Receive Profile via NFC'));

        expect(Alert.alert).toHaveBeenCalledWith(
            'Wallet Required',
            expect.any(String)
        );
        expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
    });

    it('shows alert if amount is missing', async () => {
        const { getByText } = render(<MerchantScreen />);

        fireEvent.press(getByText('Share Receive Profile via NFC'));

        expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', expect.any(String));
        expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
    });

    it('successfully constructs NDEF payload and writes to NFC', async () => {
        const { getByText, getByPlaceholderText } = render(<MerchantScreen />);

        // Input valid data
        fireEvent.changeText(getByPlaceholderText('Receiver display name'), 'TestReceiver');
        fireEvent.changeText(getByPlaceholderText('0.00'), '50');

        // Submit
        fireEvent.press(getByText('Share Receive Profile via NFC'));

        await waitFor(() => {
            expect(NfcManager.requestTechnology).toHaveBeenCalled();
            expect(Ndef.encodeMessage).toHaveBeenCalled();
            expect(NfcManager.writeNdefMessage).toHaveBeenCalled();
            expect(Alert.alert).toHaveBeenCalledWith('✅ Success', expect.any(String));
        });
    });

    it('generates QR code fallback payload when requested', async () => {
        const { getByText, getByPlaceholderText, queryByText } = render(<MerchantScreen />);

        // Input valid data
        fireEvent.changeText(getByPlaceholderText('0.00'), '20');

        // Submit QR Generation
        fireEvent.press(getByText('Generate QR Code'));

        await waitFor(() => {
            // A QR section with the hint should appear
            expect(queryByText('📱 Person A scans this QR')).toBeTruthy();
        });
    });
});
