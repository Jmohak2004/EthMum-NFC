import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { COLORS, SPACING, RADIUS, FONT, GRADIENTS, SHADOWS } from '../theme';
import GlassButton from '../components/GlassButton';
import NfcPulse from '../components/NfcPulse';

const TOKENS = ['USDC', 'ETH'];

export default function MerchantScreen() {
    const [merchantName, setMerchantName] = useState('CoffeeShop');
    const [walletAddress, setWalletAddress] = useState('0x123abc456def789');
    const [amount, setAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState('USDC');
    const [nfcStatus, setNfcStatus] = useState('idle'); // idle | writing | success | error

    const sendPayment = useCallback(async () => {
        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
            return;
        }

        const paymentData = JSON.stringify({
            merchant: merchantName,
            wallet: walletAddress,
            amount: amount,
            token: selectedToken,
            timestamp: new Date().toISOString(),
        });

        try {
            setNfcStatus('writing');

            await NfcManager.requestTechnology(NfcManager.NfcTech?.Ndef || 'Ndef');

            const bytes = Ndef.encodeMessage([Ndef.textRecord(paymentData)]);

            await NfcManager.writeNdefMessage(bytes);

            setNfcStatus('success');
            Alert.alert('✅ Success', 'Payment request written! Tap the customer\'s phone now.');
        } catch (e) {
            console.warn('NFC Write Error:', e);
            setNfcStatus('error');
            Alert.alert('NFC Error', e?.message || 'Failed to write NFC. Make sure NFC is enabled.');
        } finally {
            try {
                await NfcManager.cancelTechnologyRequest();
            } catch (_) { }
        }
    }, [amount, merchantName, walletAddress, selectedToken]);

    const resetStatus = () => setNfcStatus('idle');

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <View style={styles.titleRow}>
                    <Ionicons name="storefront" size={28} color={COLORS.primary} />
                    <Text style={styles.title}>Merchant</Text>
                </View>
                <Text style={styles.subtitle}>Create a payment request via NFC</Text>

                {/* Merchant Name */}
                <Text style={styles.label}>Merchant Name</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={18} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        value={merchantName}
                        onChangeText={setMerchantName}
                        placeholderTextColor={COLORS.textMuted}
                        placeholder="Your business name"
                    />
                </View>

                {/* Wallet */}
                <Text style={styles.label}>Wallet Address</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="wallet-outline" size={18} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        value={walletAddress}
                        onChangeText={setWalletAddress}
                        placeholderTextColor={COLORS.textMuted}
                        placeholder="0x..."
                        autoCapitalize="none"
                    />
                </View>

                {/* Token Selector */}
                <Text style={styles.label}>Token</Text>
                <View style={styles.tokenRow}>
                    {TOKENS.map((t) => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setSelectedToken(t)}
                            style={[
                                styles.tokenChip,
                                selectedToken === t && styles.tokenChipActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tokenChipText,
                                    selectedToken === t && styles.tokenChipTextActive,
                                ]}
                            >
                                {t}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Amount */}
                <Text style={styles.label}>Amount</Text>
                <View style={styles.inputContainer}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                        style={[styles.input, styles.amountInput]}
                        value={amount}
                        onChangeText={setAmount}
                        placeholderTextColor={COLORS.textMuted}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                    />
                </View>

                {/* NFC Pulse Animation */}
                <View style={styles.pulseContainer}>
                    <NfcPulse
                        active={nfcStatus === 'writing'}
                        color={
                            nfcStatus === 'success'
                                ? COLORS.success
                                : nfcStatus === 'error'
                                    ? COLORS.danger
                                    : COLORS.primary
                        }
                    />
                    <Text style={styles.statusText}>
                        {nfcStatus === 'idle' && 'Ready to send'}
                        {nfcStatus === 'writing' && 'Hold near customer\'s phone...'}
                        {nfcStatus === 'success' && 'Payment request sent!'}
                        {nfcStatus === 'error' && 'Failed — try again'}
                    </Text>
                </View>

                {/* Send Button */}
                <GlassButton
                    title="Send Payment via NFC"
                    onPress={nfcStatus === 'success' ? resetStatus : sendPayment}
                    icon={
                        <Ionicons
                            name={nfcStatus === 'success' ? 'refresh' : 'radio-outline'}
                            size={22}
                            color="#fff"
                        />
                    }
                    gradient={
                        nfcStatus === 'success'
                            ? GRADIENTS.success
                            : GRADIENTS.primary
                    }
                    disabled={nfcStatus === 'writing'}
                    style={{ marginTop: SPACING.md }}
                />

                {/* Preview */}
                <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>📦 Payment Payload Preview</Text>
                    <Text style={styles.previewJson}>
                        {JSON.stringify(
                            {
                                merchant: merchantName,
                                wallet: walletAddress,
                                amount: amount || '0',
                                token: selectedToken,
                            },
                            null,
                            2
                        )}
                    </Text>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        padding: SPACING.lg,
        paddingTop: Platform.OS === 'android' ? 50 : 60,
        paddingBottom: 120,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    title: {
        color: COLORS.text,
        fontSize: FONT.size.xxl,
        ...FONT.bold,
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        marginBottom: SPACING.xl,
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        ...FONT.medium,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        fontSize: FONT.size.md,
        paddingVertical: SPACING.md,
    },
    dollarSign: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.xl,
        ...FONT.light,
    },
    amountInput: {
        fontSize: FONT.size.xl,
        ...FONT.bold,
    },
    tokenRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    tokenChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    tokenChipActive: {
        backgroundColor: COLORS.primaryDim,
        borderColor: COLORS.primary,
    },
    tokenChipText: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        ...FONT.medium,
    },
    tokenChipTextActive: {
        color: COLORS.primary,
        ...FONT.bold,
    },
    pulseContainer: {
        alignItems: 'center',
        marginTop: SPACING.xl,
        marginBottom: SPACING.md,
    },
    statusText: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        marginTop: SPACING.sm,
    },
    previewCard: {
        marginTop: SPACING.xl,
        backgroundColor: COLORS.glass,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        padding: SPACING.md,
    },
    previewTitle: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        ...FONT.medium,
        marginBottom: SPACING.sm,
    },
    previewJson: {
        color: COLORS.primary,
        fontSize: FONT.size.xs,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        lineHeight: 18,
    },
});
