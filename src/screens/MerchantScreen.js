import React, { useState, useCallback, useEffect } from 'react';
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
import NfcManager, { Ndef } from '../utils/nfcProxy';
import { ethers } from 'ethers';
import QRCode from 'react-native-qrcode-svg';
import { useAppKit, useAccount } from '@reown/appkit-react-native';
import { COLORS, SPACING, RADIUS, FONT, GRADIENTS, SHADOWS } from '../theme';
import GlassButton from '../components/GlassButton';
import NfcPulse from '../components/NfcPulse';
import { CHAINS, CHAIN_KEYS, DEFAULT_CHAIN } from '../config/blockchain';
import { resolveENS, resolvePrimaryENS, shortenAddress } from '../utils/wallet';

const TOKENS = ['USDC', 'ETH'];

export default function MerchantScreen() {
    const [receiverName, setReceiverName] = useState('Person B');
    const [walletAddress, setWalletAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState('USDC');
    const [selectedChain, setSelectedChain] = useState(DEFAULT_CHAIN);
    const [nfcStatus, setNfcStatus] = useState('idle'); // idle | writing | success | error
    const [qrPayload, setQrPayload] = useState(null);
    const [connectedEnsName, setConnectedEnsName] = useState(null);
    const [resolvingWallet, setResolvingWallet] = useState(false);

    const { open: openWallet } = useAppKit();
    const { address: connectedAddress, isConnected } = useAccount();
    const receiverReady = Boolean(isConnected && connectedAddress && !resolvingWallet);

    useEffect(() => {
        let active = true;

        const hydrateConnectedWallet = async () => {
            if (!isConnected || !connectedAddress) {
                if (!active) return;
                setConnectedEnsName(null);
                setWalletAddress('');
                setResolvingWallet(false);
                return;
            }

            if (active) {
                setResolvingWallet(true);
            }

            const ensName = await resolvePrimaryENS(connectedAddress);
            if (!active) return;

            if (ensName) {
                setConnectedEnsName(ensName);
                setWalletAddress(ensName);
            } else {
                setConnectedEnsName(null);
                setWalletAddress(connectedAddress);
            }

            setResolvingWallet(false);
        };

        hydrateConnectedWallet().catch((e) => {
            console.warn('Wallet autofill failed:', e);
            if (active) {
                setWalletAddress(connectedAddress || '');
                setConnectedEnsName(null);
                setResolvingWallet(false);
            }
        });

        return () => {
            active = false;
        };
    }, [isConnected, connectedAddress]);

    const validateInputs = useCallback(() => {
        if (!isConnected || !connectedAddress) {
            Alert.alert('Wallet Required', 'Strict receiver mode is enabled. Connect your wallet to share your receive profile.');
            return false;
        }

        if (resolvingWallet) {
            Alert.alert('Please Wait', 'Resolving your wallet ENS profile. Try again in a moment.');
            return false;
        }

        if (!amount || !/^\d+(\.\d+)?$/.test(amount) || parseFloat(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid number (e.g. 1.50).');
            return false;
        }

        if (!walletAddress.trim()) {
            Alert.alert('Missing Address', 'Please enter a wallet address (0x...) or ENS name (.eth).');
            return false;
        }

        return true;
    }, [amount, walletAddress, isConnected, connectedAddress, resolvingWallet]);

    const buildPaymentPayload = useCallback(async () => {
        const rawWalletInput = (connectedEnsName || connectedAddress || '').trim();
        const chainConfig = CHAINS[selectedChain];

        const isEnsInput = rawWalletInput.toLowerCase().endsWith('.eth');
        let resolvedWalletAddress = null;
        let ensName = null;

        if (isEnsInput) {
            ensName = rawWalletInput.toLowerCase();
            resolvedWalletAddress = await resolveENS(ensName);
            if (!resolvedWalletAddress) {
                throw new Error(`Could not resolve ENS name "${rawWalletInput}".`);
            }
        } else {
            if (!ethers.isAddress(rawWalletInput)) {
                throw new Error('Please enter a valid Ethereum address (0x...) or ENS name (.eth).');
            }
            resolvedWalletAddress = ethers.getAddress(rawWalletInput);
            ensName = await resolvePrimaryENS(resolvedWalletAddress);
        }

        return {
            version: 2,
            mode: 'receive-profile',
            receiverName,
            ens: ensName || null,
            wallet: resolvedWalletAddress,
            preferredChain: selectedChain,
            preferredToken: selectedToken,
            suggestedAmount: amount,
            chainId: chainConfig.hexChainId,
            decimals: selectedToken === 'USDC' ? 6 : 18,
            timestamp: new Date().toISOString(),

            // Legacy keys retained for backward compatibility.
            merchant: receiverName,
            amount,
            token: selectedToken,
            chain: selectedChain,
        };
    }, [connectedEnsName, connectedAddress, selectedChain, receiverName, amount, selectedToken]);

    const sendPayment = useCallback(async () => {
        if (!validateInputs()) {
            return;
        }

        if (paymentData.length > 500) {
            Alert.alert('Payload Too Large', 'Payment data may exceed NFC tag capacity. Try shortening the merchant name.');
            return;
        }

        try {
            const payload = await buildPaymentPayload();
            const paymentData = JSON.stringify(payload);

            if (paymentData.length > 500) {
                Alert.alert('Payload Too Large', 'Payment data may exceed NFC tag capacity. Try shortening the receiver name.');
                return;
            }

            const supported = await NfcManager.isSupported();
            if (!supported) {
                Alert.alert('NFC Unavailable', 'This device does not support NFC. You need a physical Android device to write NFC tags.');
                return;
            }

            setNfcStatus('writing');

            await NfcManager.requestTechnology(NfcManager.NfcTech?.Ndef || 'Ndef');

            const bytes = Ndef.encodeMessage([Ndef.textRecord(paymentData)]);

            await NfcManager.writeNdefMessage(bytes);

            setNfcStatus('success');
            Alert.alert('✅ Success', 'Receive profile shared. Person A can now tap and confirm payment.');
        } catch (e) {
            console.warn('NFC Write Error:', e);
            if (e?.message?.includes('ENS') || e?.message?.includes('valid Ethereum address')) {
                setNfcStatus('idle');
                Alert.alert('Invalid Address', e.message);
                return;
            }
            setNfcStatus('error');
            Alert.alert('NFC Error', e?.message || 'Failed to write NFC. Make sure NFC is enabled.');
        } finally {
            try {
                await NfcManager.cancelTechnologyRequest();
            } catch (_) { }
        }
    }, [validateInputs, buildPaymentPayload]);

    const resetStatus = () => setNfcStatus('idle');

    const generateQr = useCallback(async () => {
        if (!validateInputs()) {
            return;
        }

        try {
            const payload = await buildPaymentPayload();
            setQrPayload(JSON.stringify(payload));
        } catch (e) {
            Alert.alert('Invalid Address', e?.message || 'Could not build payment payload.');
        }
    }, [validateInputs, buildPaymentPayload]);

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <View style={styles.titleRow}>
                    <Ionicons name="person-circle-outline" size={28} color={COLORS.primary} />
                    <Text style={styles.title}>Receive</Text>
                </View>
                <Text style={styles.subtitle}>Person B shares ENS, wallet, and preferred chain</Text>

                <View style={styles.spendingNote}>
                    <View style={styles.spendingNoteIcon}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textDark} />
                    </View>
                    <Text style={styles.spendingBody}>
                        <Text style={styles.spendingBold}>Strict mode:</Text> only connected wallet identity can be shared.
                    </Text>
                </View>

                <View style={styles.walletConnectionSection}>
                    {isConnected ? (
                        <View style={styles.connectedWalletChip}>
                            <Ionicons name="wallet" size={16} color={COLORS.success} />
                            <Text style={styles.connectedWalletText}>
                                {connectedEnsName || shortenAddress(connectedAddress)}
                            </Text>
                            <Text
                                style={styles.changeWalletLink}
                                onPress={() => openWallet()}
                            >
                                Change
                            </Text>
                        </View>
                    ) : (
                        <GlassButton
                            title="Connect Wallet & Auto-fill"
                            onPress={() => openWallet()}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="wallet-outline" size={20} color={COLORS.textDark} />}
                        />
                    )}

                    {isConnected && (
                        <Text style={styles.walletConnectionHint}>
                            {resolvingWallet
                                ? 'Resolving primary ENS...'
                                : 'Wallet field is auto-filled from your connected wallet.'}
                        </Text>
                    )}
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                    <View style={styles.panelHandle} />
                    <Text style={styles.formSectionTitle}>Receive Profile</Text>
                {/* Receiver Name */}
                <Text style={styles.label}>Receiver Name</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        value={receiverName}
                        onChangeText={setReceiverName}
                        placeholderTextColor={COLORS.textMuted}
                        placeholder="Receiver display name"
                    />
                </View>

                {/* Wallet */}
                <Text style={styles.label}>Receiver ENS or Wallet</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="wallet-outline" size={18} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        value={walletAddress}
                        onChangeText={setWalletAddress}
                        placeholderTextColor={COLORS.textMuted}
                        placeholder="Connect wallet to auto-fill"
                        autoCapitalize="none"
                        editable={false}
                    />
                </View>

                {/* Chain Selector */}
                <Text style={styles.label}>Preferred Network</Text>
                <View style={styles.tokenRow}>
                    {CHAIN_KEYS.map((key) => (
                        <TouchableOpacity
                            key={key}
                            onPress={() => setSelectedChain(key)}
                            style={[
                                styles.tokenChip,
                                selectedChain === key && styles.chainChipActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tokenChipText,
                                    selectedChain === key && styles.chainChipTextActive,
                                ]}
                            >
                                {CHAINS[key].name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Token Selector */}
                <Text style={styles.label}>Preferred Token</Text>
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
                <Text style={styles.label}>Requested Amount</Text>
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
                        {nfcStatus === 'idle' && 'Ready to share receive profile'}
                        {nfcStatus === 'writing' && 'Hold near Person A phone...'}
                        {nfcStatus === 'success' && 'Receive profile shared!'}
                        {nfcStatus === 'error' && 'Failed — try again'}
                    </Text>
                </View>

                {/* Send Button */}
                <GlassButton
                    title="Share Receive Profile via NFC"
                    onPress={nfcStatus === 'success' ? resetStatus : sendPayment}
                    icon={
                        <Ionicons
                            name={nfcStatus === 'success' ? 'refresh' : 'radio-outline'}
                            size={22}
                            color={nfcStatus === 'success' ? COLORS.white : COLORS.textDark}
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

                {!receiverReady && (
                    <Text style={styles.strictModeHelp}>
                        Connect wallet first to enable profile sharing.
                    </Text>
                )}

                {/* QR Code Fallback */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>

                <GlassButton
                    title={qrPayload ? 'Regenerate QR Code' : 'Generate QR Code'}
                    onPress={generateQr}
                    gradient={GRADIENTS.primary}
                    icon={<Ionicons name="qr-code-outline" size={22} color={COLORS.textDark} />}
                    disabled={!receiverReady}
                    style={{ marginTop: SPACING.sm }}
                />

                {qrPayload && (
                    <View style={styles.qrCard}>
                        <View style={styles.qrCardHeader}>
                            <Ionicons name="qr-code" size={24} color={COLORS.primary} />
                            <Text style={styles.qrTitle}>Person A scans this QR</Text>
                        </View>
                        <View style={styles.qrContainer}>
                            <QRCode
                                value={qrPayload}
                                size={200}
                                backgroundColor="transparent"
                                color={COLORS.text}
                            />
                        </View>
                        <Text style={styles.qrHint}>Person A opens Send tab | Scan QR | Confirm</Text>
                    </View>
                )}

                {/* Preview */}
                <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>📦 Payment Payload Preview</Text>
                    <Text style={styles.previewJson}>
                        {JSON.stringify(
                            {
                                version: 2,
                                mode: 'receive-profile',
                                receiverName,
                                ens: walletAddress.toLowerCase().endsWith('.eth')
                                    ? walletAddress
                                    : connectedEnsName,
                                wallet: walletAddress.toLowerCase().endsWith('.eth')
                                    ? 'resolved-on-send'
                                    : walletAddress,
                                suggestedAmount: amount || '0',
                                preferredToken: selectedToken,
                                decimals: selectedToken === 'USDC' ? 6 : 18,
                                preferredChain: CHAINS[selectedChain].name,
                                chainId: CHAINS[selectedChain].hexChainId,
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
    spendingNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: COLORS.yellowLight,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
    },
    spendingNoteIcon: {
        width: 28,
        height: 28,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spendingBody: {
        flex: 1,
        fontSize: FONT.size.md,
        color: COLORS.textDark,
        lineHeight: 20,
    },
    spendingBold: {
        fontWeight: '700',
        color: COLORS.textDark,
    },
    formCard: {
        backgroundColor: COLORS.darkCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.darkBorder,
        ...SHADOWS.card,
    },
    panelHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.darkSurface,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    formSectionTitle: {
        color: COLORS.text,
        fontSize: FONT.size.lg,
        ...FONT.semibold,
        marginBottom: SPACING.lg,
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
    chainChipActive: {
        backgroundColor: COLORS.secondaryDim,
        borderColor: COLORS.secondary,
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
    chainChipTextActive: {
        color: COLORS.secondary,
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
    walletConnectionSection: {
        marginBottom: SPACING.md,
    },
    connectedWalletChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.success,
        borderRadius: RADIUS.full,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    connectedWalletText: {
        color: COLORS.success,
        fontSize: FONT.size.sm,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    changeWalletLink: {
        color: COLORS.textMuted,
        fontSize: FONT.size.sm,
        marginLeft: SPACING.xs,
        textDecorationLine: 'underline',
    },
    walletConnectionHint: {
        color: COLORS.textMuted,
        fontSize: FONT.size.xs,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    strictModeHelp: {
        color: COLORS.warning,
        fontSize: FONT.size.xs,
        textAlign: 'center',
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xl,
        gap: SPACING.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.glassBorder,
    },
    dividerText: {
        color: COLORS.textMuted,
        fontSize: FONT.size.sm,
        ...FONT.bold,
    },
    qrCard: {
        alignItems: 'center',
        backgroundColor: COLORS.darkCard,
        borderWidth: 1,
        borderColor: COLORS.darkBorder,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        marginTop: SPACING.lg,
        ...SHADOWS.card,
    },
    qrCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    qrTitle: {
        color: COLORS.text,
        fontSize: FONT.size.lg,
        ...FONT.semibold,
    },
    qrContainer: {
        padding: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: RADIUS.md,
    },
    qrHint: {
        color: COLORS.textMuted,
        fontSize: FONT.size.sm,
        marginTop: SPACING.md,
    },
});
