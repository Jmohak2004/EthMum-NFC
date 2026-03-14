import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MerchantScreen from '../src/screens/MerchantScreen';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert');

describe('MerchantScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly and defaults to USDC on Base Sepolia', () => {
        const { getByText, getByPlaceholderText } = render(<MerchantScreen />);
        expect(getByText('Merchant')).toBeTruthy();
        expect(getByPlaceholderText('Your business name')).toBeTruthy();
        expect(getByPlaceholderText('0x... or name.eth')).toBeTruthy();
        expect(getByPlaceholderText('0.00')).toBeTruthy();
    });

    it('shows alert if amount is missing', async () => {
        const { getByText } = render(<MerchantScreen />);
        
        fireEvent.press(getByText('Send Payment via NFC'));
        
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', expect.any(String));
        expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
    });

    it('shows alert if wallet is missing', async () => {
        const { getByText, getByPlaceholderText } = render(<MerchantScreen />);
        
        fireEvent.changeText(getByPlaceholderText('0.00'), '10');
        fireEvent.press(getByText('Send Payment via NFC'));
        
        expect(Alert.alert).toHaveBeenCalledWith('Missing Address', expect.any(String));
        expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
    });

    it('successfully constructs NDEF payload and writes to NFC', async () => {
        const { getByText, getByPlaceholderText } = render(<MerchantScreen />);
        
        // Input valid data
        fireEvent.changeText(getByPlaceholderText('Your business name'), 'TestShop');
        fireEvent.changeText(getByPlaceholderText('0.00'), '50');
        fireEvent.changeText(getByPlaceholderText('0x... or name.eth'), 'vitalik.eth');
        
        // Submit
        fireEvent.press(getByText('Send Payment via NFC'));
        
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
        fireEvent.changeText(getByPlaceholderText('0x... or name.eth'), '0x1234567890123456789012345678901234567890');
        
        // Submit QR Generation
        fireEvent.press(getByText('Generate QR Code'));
        
        await waitFor(() => {
            // A QR section with the hint should appear
            expect(queryByText('📱 Customer scans this QR')).toBeTruthy();
        });
    });
});
