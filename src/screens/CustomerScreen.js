import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    Linking,
    Platform,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { Ndef } from '../utils/nfcProxy';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppKit, useAccount, useProvider } from '@reown/appkit-react-native';
import { COLORS, SPACING, RADIUS, FONT, GRADIENTS, SHADOWS } from '../theme';
import GlassButton from '../components/GlassButton';
import NfcPulse from '../components/NfcPulse';
import PaymentCard from '../components/PaymentCard';
import {
    getEtherscanUrl, resolveENSProfile,
    sendETHViaProvider, sendUSDCViaProvider, shortenAddress,
} from '../utils/wallet';
import { saveTransaction } from '../utils/storage';
import { CHAINS, getChainConfig } from '../config/blockchain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_EXTRA_PADDING, SCREEN_WIDTH } from '../utils/responsive';

export default function CustomerScreen() {
    const insets = useSafeAreaInsets();
    const [payment, setPayment] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [qrScanning, setQrScanning] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendingStatus, setSendingStatus] = useState('');
    const [pendingHash, setPendingHash] = useState(null);
    const [txResult, setTxResult] = useState(null);
    const [ensProfile, setEnsProfile] = useState(null);
    const [permission, requestPermission] = useCameraPermissions();
    const qrScannedRef = useRef(false);

    // WalletConnect hooks
    const { open: openWallet } = useAppKit();
    const { address: connectedAddress, isConnected } = useAccount();
    const { provider: walletProvider } = useProvider();
    const senderReady = Boolean(isConnected && connectedAddress && walletProvider);

    const parseReceiverProfile = useCallback((rawData) => {
        const parsed = JSON.parse(rawData);
        const receiverProfile = {
            ...parsed,
            mode: parsed.mode || 'receive-profile',
            receiverName: parsed.receiverName || parsed.merchant || 'Person B',
            preferredToken: parsed.preferredToken || parsed.token || 'USDC',
            suggestedAmount: parsed.suggestedAmount || parsed.amount,
            preferredChain: parsed.preferredChain || parsed.chain,
        };

        const amountValue = Number(receiverProfile.suggestedAmount);
        if (receiverProfile.mode !== 'receive-profile') {
            throw new Error('Receiver profile is not in supported format.');
        }
        if (!receiverProfile.wallet) {
            throw new Error('Receiver wallet address is missing in NFC payload.');
        }
        if (!receiverProfile.suggestedAmount || Number.isNaN(amountValue) || amountValue <= 0) {
            throw new Error('Receiver payment amount is missing or invalid.');
        }
        if (!receiverProfile.preferredChain || !CHAINS[receiverProfile.preferredChain]) {
            throw new Error('Receiver preferred chain is missing or unsupported.');
        }
        if (!receiverProfile.preferredToken || !['ETH', 'USDC'].includes(receiverProfile.preferredToken)) {
            throw new Error('Receiver preferred token is missing or unsupported.');
        }

        return receiverProfile;
    }, []);

    // Fetch ENS profile when payment is received
    useEffect(() => {
        if (payment?.ens) {
            setEnsProfile(null);
            resolveENSProfile(payment.ens).then((profile) => {
                if (profile) setEnsProfile(profile);
            });
        } else if (payment?.wallet) {
            setEnsProfile(null);
            // Try reverse lookup for raw addresses
            resolveENSProfile(payment.wallet).then((profile) => {
                if (profile?.ensName) setEnsProfile(profile);
            });
        } else {
            setEnsProfile(null);
        }
    }, [payment]);

    const readNfc = useCallback(async (silent = false) => {
        try {
            if (!senderReady) {
                if (!silent) {
                    Alert.alert('Wallet Required', 'Connect your wallet first to start the send flow.');
                }
                return;
            }

            const supported = await NfcManager.isSupported();
            if (!supported) {
                if (!silent) {
                    Alert.alert('NFC Unavailable', 'This device does not support NFC. You need a physical Android device to scan NFC tags.');
                }
                return;
            }

            setScanning(true);
            setPayment(null);
            setTxResult(null);

            await NfcManager.requestTechnology(NfcManager.NfcTech?.Ndef || 'Ndef');

            const tag = await NfcManager.getTag();

            if (tag?.ndefMessage?.[0]?.payload) {
                const payload = Ndef.text.decodePayload(tag.ndefMessage[0].payload);
                const receiverProfile = parseReceiverProfile(payload);
                setPayment(receiverProfile);
            } else {
                Alert.alert('No Data', 'NFC tag does not contain payment data.');
            }
        } catch (e) {
            console.warn('NFC Read Error:', e);
            if (e?.message !== 'cancelled') {
                Alert.alert('NFC Error', e?.message || 'Failed to read NFC tag.');
            }
        } finally {
            setScanning(false);
            try {
                await NfcManager.cancelTechnologyRequest();
            } catch (_) { }
        }
    }, [senderReady, parseReceiverProfile]);

    const openQrScanner = useCallback(async () => {
        if (!senderReady) {
            Alert.alert('Wallet Required', 'Connect your wallet first to start the send flow.');
            return;
        }

        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed to scan QR codes.');
                return;
            }
        }
        qrScannedRef.current = false;
        setQrScanning(true);
    }, [permission, requestPermission, senderReady]);

    const handleQrScanned = useCallback(({ data }) => {
        if (qrScannedRef.current) return;
        qrScannedRef.current = true;
        try {
            const receiverProfile = parseReceiverProfile(data);
            setQrScanning(false);
            setPayment(receiverProfile);
        } catch (e) {
            Alert.alert('Invalid QR', e?.message || 'Could not read payment data from this QR code.');
            setQrScanning(false);
        }
    }, [parseReceiverProfile]);

    const executePayment = useCallback(async () => {
        if (!payment) return;

        try {
            if (!senderReady) {
                Alert.alert('Wallet Required', 'Connect your wallet first before confirming the transaction.');
                return;
            }

            setSending(true);
            setPendingHash(null);

            const recipientName = payment.receiverName || payment.merchant || 'Person B';
            const tokenToSend = payment.preferredToken || payment.token || 'USDC';
            const amountToSend = payment.suggestedAmount || payment.amount;
            const chainKey = payment.preferredChain || payment.chain || 'base-sepolia';

            if (!amountToSend || parseFloat(amountToSend) <= 0) {
                Alert.alert('Missing Amount', `${recipientName} did not provide a valid requested amount.`);
                setSending(false);
                return;
            }

            const toAddress = payment.wallet;
            if (!toAddress) {
                Alert.alert('Missing Receiver Wallet', 'Receiver wallet address is required to prepare this transaction.');
                return;
            }

            let result;

            const chainName = getChainConfig(chainKey).name;

            setSendingStatus(`Switching to ${chainName}...`);
            if (tokenToSend === 'ETH') {
                result = await sendETHViaProvider(walletProvider, toAddress, amountToSend, chainKey);
            } else {
                result = await sendUSDCViaProvider(walletProvider, toAddress, amountToSend, chainKey);
            }

            setPendingHash(result.hash);
            setSendingStatus('Confirming on-chain...');

            result.receiverName = recipientName;
            result.chain = chainKey;
            result.ensName = ensProfile?.ensName || payment.ens || null;
            setTxResult(result);

            await saveTransaction(result);

            setSendingStatus('');
        } catch (e) {
            console.warn('Transaction Error:', e);
            Alert.alert(
                '❌ Transaction Failed',
                e?.message || 'Could not send transaction. Check wallet balance.',
            );
        } finally {
            setSending(false);
            setSendingStatus('');
            setPendingHash(null);
        }
    }, [payment, senderReady, walletProvider, ensProfile]);

    const confirmPayment = useCallback(() => {
        if (!payment || sending) return;
        if (!senderReady) {
            Alert.alert('Wallet Required', 'Connect your wallet before confirming this transaction.');
            return;
        }

        const recipientLabel = payment.ens || payment.wallet || 'Unknown recipient';
        const chainName = getChainConfig(payment.preferredChain || payment.chain || 'base-sepolia').name;
        const tokenToSend = payment.preferredToken || payment.token || 'USDC';
        const amountToSend = payment.suggestedAmount || payment.amount;
        const receiverName = payment.receiverName || payment.merchant || 'Person B';
        const message = [
            `Receiver: ${receiverName}`,
            `Recipient: ${recipientLabel}`,
            `Amount: ${amountToSend} ${tokenToSend}`,
            `Receiver Chain Preference: ${chainName}`,
            '',
            'Do you want to confirm this transaction?',
        ].join('\n');

        Alert.alert('Confirm Transaction', message, [
            {
                text: 'Not Now',
                style: 'cancel',
            },
            {
                text: 'Confirm',
                style: 'default',
                onPress: () => {
                    executePayment();
                },
            },
        ]);
    }, [payment, sending, executePayment, senderReady]);

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            <ScrollView
                contentContainerStyle={[
                    styles.scroll,
                    {
                        paddingTop: Math.max(insets.top, 44) + SPACING.md,
                        paddingBottom: insets.bottom + TAB_BAR_EXTRA_PADDING,
                        paddingHorizontal: Math.max(SPACING.lg, insets.left, insets.right),
                    },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Title */}
                <View style={styles.titleRow}>
                    <Ionicons name="send-outline" size={28} color={COLORS.primary} />
                    <Text style={styles.title}>Send</Text>
                </View>
                <Text style={styles.subtitle}>Person A taps Person B to receive ENS + wallet + preferred chain</Text>

                <View style={styles.spendingNote}>
                    <View style={styles.spendingNoteIcon}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textDark} />
                    </View>
                    <Text style={styles.spendingBody}>
                        <Text style={styles.spendingBold}>Strict flow:</Text> connect wallet, tap receiver, then confirm transaction.
                    </Text>
                </View>

                <View style={styles.walletSectionTop}>
                    {isConnected ? (
                        <View style={styles.connectedBadge}>
                            <Ionicons name="wallet" size={16} color={COLORS.success} />
                            <Text style={styles.connectedText}>
                                {shortenAddress(connectedAddress)}
                            </Text>
                            <Text
                                style={styles.disconnectLink}
                                onPress={() => openWallet()}
                            >
                                Change
                            </Text>
                        </View>
                    ) : (
                        <GlassButton
                            title="Connect Wallet to Start"
                            onPress={() => openWallet()}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="wallet-outline" size={20} color={COLORS.textDark} />}
                        />
                    )}

                    {!senderReady && (
                        <Text style={styles.strictModeHelp}>
                            Step 1: connect wallet before reading receiver profile.
                        </Text>
                    )}
                </View>

                {/* NFC Scan Area */}
                {!payment && !qrScanning && (
                    <View style={styles.scanCard}>
                        <View style={styles.panelHandle} />
                        <View style={styles.scanSection}>
                            <NfcPulse
                                active={scanning}
                                color={COLORS.primary}
                                size={90}
                            />
                            <Text style={styles.scanLabel}>
                                {scanning ? 'Scanning for receiver profile...' : 'Tap Person B phone or scan QR'}
                            </Text>
                            {!scanning && (
                                <>
                                    <GlassButton
                                        title="Read Receiver via NFC"
                                        onPress={readNfc}
                                        gradient={GRADIENTS.primary}
                                        icon={<Ionicons name="radio-outline" size={20} color={COLORS.textDark} />}
                                        disabled={!senderReady}
                                        style={{ marginTop: SPACING.lg }}
                                    />
                                    <View style={styles.divider}>
                                        <View style={styles.dividerLine} />
                                        <Text style={styles.dividerText}>OR</Text>
                                        <View style={styles.dividerLine} />
                                    </View>
                                    <GlassButton
                                        title="Scan QR Code"
                                        onPress={openQrScanner}
                                        gradient={GRADIENTS.primary}
                                        icon={<Ionicons name="qr-code-outline" size={20} color={COLORS.textDark} />}
                                        disabled={!senderReady}
                                        style={{ marginTop: SPACING.md }}
                                    />
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* QR Scanner */}
                {qrScanning && !payment && (
                    <View style={styles.qrSection}>
                        <View style={styles.qrScannerContainer}>
                            <CameraView
                                style={styles.qrScanner}
                                barcodeScannerSettings={{
                                    barcodeTypes: ['qr'],
                                }}
                                onBarcodeScanned={handleQrScanned}
                            />
                            <View style={styles.qrOverlay}>
                                <View style={styles.qrFrame} />
                            </View>
                        </View>
                        <Text style={styles.qrScanLabel}>Point camera at Person B QR code</Text>
                        <GlassButton
                            title="Cancel"
                            onPress={() => setQrScanning(false)}
                            gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            icon={<Ionicons name="close" size={20} color={COLORS.textSecondary} />}
                            style={{ marginTop: SPACING.md }}
                        />
                    </View>
                )}

                {/* Payment Details */}
                {payment && !txResult && (
                    <View style={styles.paymentSection}>
                        <View style={styles.badge}>
                            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                            <Text style={styles.badgeText}>Receiver Profile Received</Text>
                        </View>

                        <PaymentCard
                            merchant={payment.receiverName || payment.merchant || 'Receiver'}
                            wallet={ensProfile?.address || payment.wallet}
                            amount={payment.suggestedAmount || payment.amount}
                            token={payment.preferredToken || payment.token}
                            ensName={ensProfile?.ensName || payment.ens}
                            avatar={ensProfile?.avatar}
                            chain={payment.preferredChain || payment.chain}
                            textRecords={ensProfile?.textRecords}
                        />

                        {/* Sending Progress */}
                        {sending && (
                            <View style={styles.sendingCard}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                                <Text style={styles.sendingStatus}>{sendingStatus}</Text>
                                {pendingHash && (
                                    <View style={styles.hashContainer}>
                                        <Text style={styles.hashLabel}>Tx Hash:</Text>
                                        <Text
                                            style={styles.hashValue}
                                            onPress={() => Linking.openURL(getEtherscanUrl(pendingHash, payment?.preferredChain || payment?.chain))}
                                        >
                                            {pendingHash.slice(0, 10)}...{pendingHash.slice(-8)}
                                        </Text>
                                        <Text style={styles.hashHint}>Tap to view on {getChainConfig(payment?.preferredChain || payment?.chain || 'base-sepolia').name} Explorer</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <GlassButton
                            title={sending ? 'Sending...' : 'Confirm & Send'}
                            onPress={confirmPayment}
                            gradient={GRADIENTS.success}
                            disabled={sending || !senderReady}
                            icon={
                                <Ionicons
                                    name={sending ? 'hourglass-outline' : 'send'}
                                    size={20}
                                    color={COLORS.white}
                                />
                            }
                            style={{ marginTop: SPACING.md }}
                        />

                        {!sending && (
                            <GlassButton
                                title="Cancel"
                                onPress={() => { setPayment(null); readNfc(); }}
                                gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                                icon={<Ionicons name="close" size={20} color={COLORS.textSecondary} />}
                                style={{ marginTop: SPACING.sm }}
                            />
                        )}
                    </View>
                )}

                {/* Transaction Complete */}
                {txResult && (
                    <View style={styles.paymentSection}>
                        <View style={[styles.badge, { backgroundColor: COLORS.successDim }]}>
                            <Ionicons name="checkmark-done" size={16} color={COLORS.success} />
                            <Text style={[styles.badgeText, { color: COLORS.success }]}>
                                Transfer Confirmed
                            </Text>
                        </View>

                        <PaymentCard
                            merchant={txResult.receiverName || payment?.receiverName || payment?.merchant}
                            wallet={txResult.to}
                            amount={txResult.amount}
                            token={txResult.token}
                            txHash={txResult.hash}
                            timestamp={txResult.timestamp}
                            ensName={ensProfile?.ensName}
                            avatar={ensProfile?.avatar}
                            chain={payment?.preferredChain || payment?.chain}
                            textRecords={ensProfile?.textRecords}
                        />

                        <GlassButton
                            title={`View on ${getChainConfig(payment?.preferredChain || payment?.chain || 'base-sepolia').name} Explorer`}
                            onPress={() => Linking.openURL(getEtherscanUrl(txResult.hash, payment?.preferredChain || payment?.chain))}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="open-outline" size={20} color={COLORS.textDark} />}
                            style={{ marginTop: SPACING.md }}
                        />

                        <GlassButton
                            title="Send Another"
                            onPress={() => { setPayment(null); setTxResult(null); readNfc(); }}
                            gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            icon={<Ionicons name="add" size={20} color={COLORS.textSecondary} />}
                            style={{ marginTop: SPACING.sm }}
                        />
                    </View>
                )}
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
        flexGrow: 1,
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
        marginBottom: SPACING.lg,
    },
    strictModeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        alignSelf: 'flex-start',
        backgroundColor: COLORS.warning + '1A',
        borderWidth: 1,
        borderColor: COLORS.warning + '66',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        marginBottom: SPACING.md,
    },
    strictModeText: {
        color: COLORS.warning,
        fontSize: FONT.size.xs,
        ...FONT.medium,
    },
    walletSectionTop: {
        marginBottom: SPACING.md,
    },
    scanCard: {
        backgroundColor: COLORS.darkCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.darkBorder,
        width: '100%',
        alignItems: 'center',
    },
    panelHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.darkSurface,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    scanSection: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    scanLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        marginTop: SPACING.lg,
    },
    paymentSection: {
        marginTop: SPACING.md,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.glass,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.full,
        alignSelf: 'flex-start',
        marginBottom: SPACING.lg,
    },
    badgeText: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        ...FONT.medium,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.lg,
        gap: SPACING.md,
        width: '100%',
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
    qrSection: {
        alignItems: 'center',
        marginTop: SPACING.md,
    },
    qrScannerContainer: {
        width: SCREEN_WIDTH - SPACING.lg * 2,
        height: 300,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        position: 'relative',
    },
    qrScanner: {
        flex: 1,
    },
    qrOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrFrame: {
        width: 200,
        height: 200,
        borderWidth: 2,
        borderColor: COLORS.primary,
        borderRadius: RADIUS.md,
    },
    qrScanLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        marginTop: SPACING.md,
    },
    sendingCard: {
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        marginTop: SPACING.lg,
    },
    sendingStatus: {
        color: COLORS.primary,
        fontSize: FONT.size.md,
        ...FONT.medium,
        marginTop: SPACING.md,
    },
    hashContainer: {
        alignItems: 'center',
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
        width: '100%',
    },
    hashLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        ...FONT.medium,
    },
    hashValue: {
        color: COLORS.success,
        fontSize: FONT.size.md,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: SPACING.xs,
    },
    hashHint: {
        color: COLORS.textMuted,
        fontSize: FONT.size.xs,
        marginTop: SPACING.xs,
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.success,
        borderRadius: RADIUS.full,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        alignSelf: 'center',
    },
    connectedText: {
        color: COLORS.success,
        fontSize: FONT.size.sm,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    disconnectLink: {
        color: COLORS.textMuted,
        fontSize: FONT.size.sm,
        textDecorationLine: 'underline',
        marginLeft: SPACING.xs,
    },
    strictModeHelp: {
        color: COLORS.warning,
        fontSize: FONT.size.xs,
        textAlign: 'center',
        marginTop: SPACING.sm,
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
});
