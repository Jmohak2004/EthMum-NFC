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
    sendETH, sendUSDC, getEtherscanUrl, resolveENS, resolveENSProfile,
    sendETHViaProvider, sendUSDCViaProvider, shortenAddress,
} from '../utils/wallet';
import { saveTransaction } from '../utils/storage';
import { getChainConfig } from '../config/blockchain';

export default function CustomerScreen() {
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
    const { open: openWallet, close: closeWallet } = useAppKit();
    const { address: connectedAddress, isConnected } = useAccount();
    const { provider: walletProvider } = useProvider();

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
                const paymentData = JSON.parse(payload);
                setPayment(paymentData);
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
    }, []);

    const openQrScanner = useCallback(async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed to scan QR codes.');
                return;
            }
        }
        qrScannedRef.current = false;
        setQrScanning(true);
    }, [permission, requestPermission]);

    const handleQrScanned = useCallback(({ data }) => {
        if (qrScannedRef.current) return;
        qrScannedRef.current = true;
        try {
            const paymentData = JSON.parse(data);
            if ((paymentData.wallet || paymentData.ens) && paymentData.amount && paymentData.token) {
                setQrScanning(false);
                setPayment(paymentData);
            } else {
                Alert.alert('Invalid QR', 'This QR code does not contain valid payment data.');
                setQrScanning(false);
            }
        } catch (e) {
            Alert.alert('Invalid QR', 'Could not read payment data from this QR code.');
            setQrScanning(false);
        }
    }, []);

    useEffect(() => {
        readNfc(true);
    }, []);

    const confirmPayment = useCallback(async () => {
        if (!payment) return;

        try {
            setSending(true);
            setPendingHash(null);

            // Resolve ENS if needed
            let toAddress = payment.wallet;
            if (!toAddress && payment.ens) {
                setSendingStatus(`Resolving ${payment.ens}...`);
                toAddress = await resolveENS(payment.ens);
                if (!toAddress) {
                    Alert.alert('ENS Error', `Could not resolve "${payment.ens}". Check the name and try again.`);
                    setSending(false);
                    return;
                }
            }

            let result;

            const chainKey = payment.chain || 'base-sepolia';
            const chainName = getChainConfig(chainKey).name;

            // Use connected wallet if available, otherwise fall back to demo wallet
            if (isConnected && walletProvider) {
                setSendingStatus(`Switching to ${chainName}...`);
                if (payment.token === 'ETH') {
                    result = await sendETHViaProvider(walletProvider, toAddress, payment.amount, chainKey);
                } else {
                    result = await sendUSDCViaProvider(walletProvider, toAddress, payment.amount, chainKey);
                }
            } else {
                setSendingStatus('Preparing transaction...');
                if (payment.token === 'ETH') {
                    setSendingStatus(`Sending ETH on ${chainName}...`);
                    result = await sendETH(toAddress, payment.amount, chainKey);
                } else {
                    setSendingStatus(`Sending USDC on ${chainName}...`);
                    result = await sendUSDC(toAddress, payment.amount, chainKey);
                }
            }

            setPendingHash(result.hash);
            setSendingStatus('Confirming on-chain...');

            result.merchant = payment.merchant;
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
    }, [payment, isConnected, walletProvider, ensProfile]);

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Title */}
                <View style={styles.titleRow}>
                    <Ionicons name="scan-outline" size={28} color={COLORS.secondary} />
                    <Text style={styles.title}>Customer</Text>
                </View>
                <Text style={styles.subtitle}>Tap phone to receive payment request</Text>

                {/* NFC Scan Area */}
                {!payment && !qrScanning && (
                    <View style={styles.scanSection}>
                        <NfcPulse
                            active={scanning}
                            color={COLORS.secondary}
                            size={90}
                        />
                        <Text style={styles.scanLabel}>
                            {scanning ? 'Scanning for NFC...' : 'Tap NFC tag or scan QR'}
                        </Text>
                        {!scanning && (
                            <>
                                <GlassButton
                                    title="Scan NFC Tag"
                                    onPress={readNfc}
                                    gradient={[COLORS.secondary, '#b388ff']}
                                    icon={<Ionicons name="radio-outline" size={20} color="#fff" />}
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
                                    gradient={[COLORS.primary, '#00b8d4']}
                                    icon={<Ionicons name="qr-code-outline" size={20} color="#fff" />}
                                    style={{ marginTop: SPACING.md }}
                                />
                            </>
                        )}
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
                        <Text style={styles.qrScanLabel}>Point camera at merchant's QR code</Text>
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
                            <Text style={styles.badgeText}>Payment Request Received</Text>
                        </View>

                        <PaymentCard
                            merchant={payment.merchant}
                            wallet={ensProfile?.address || payment.wallet}
                            amount={payment.amount}
                            token={payment.token}
                            ensName={ensProfile?.ensName || payment.ens}
                            avatar={ensProfile?.avatar}
                            chain={payment.chain}
                            textRecords={ensProfile?.textRecords}
                        />

                        {/* Wallet Connection */}
                        <View style={styles.walletSection}>
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
                                    title="Connect Wallet (Rainbow, MetaMask...)"
                                    onPress={() => openWallet()}
                                    gradient={[COLORS.secondary, '#b388ff']}
                                    icon={<Ionicons name="wallet-outline" size={20} color="#fff" />}
                                />
                            )}
                            {!isConnected && (
                                <Text style={styles.demoHint}>
                                    Or tap Pay below to use the demo wallet
                                </Text>
                            )}
                        </View>

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
                                            onPress={() => Linking.openURL(getEtherscanUrl(pendingHash, payment?.chain))}
                                        >
                                            {pendingHash.slice(0, 10)}...{pendingHash.slice(-8)}
                                        </Text>
                                        <Text style={styles.hashHint}>Tap to view on Base Explorer</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <GlassButton
                            title={sending ? 'Sending...' : 'Confirm & Pay'}
                            onPress={confirmPayment}
                            gradient={GRADIENTS.success}
                            disabled={sending}
                            icon={
                                <Ionicons
                                    name={sending ? 'hourglass-outline' : 'send'}
                                    size={20}
                                    color="#fff"
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
                                Transaction Confirmed
                            </Text>
                        </View>

                        <PaymentCard
                            merchant={txResult.merchant}
                            wallet={txResult.to}
                            amount={txResult.amount}
                            token={txResult.token}
                            txHash={txResult.hash}
                            timestamp={txResult.timestamp}
                            ensName={ensProfile?.ensName}
                            avatar={ensProfile?.avatar}
                            chain={payment?.chain}
                            textRecords={ensProfile?.textRecords}
                        />

                        <GlassButton
                            title="View on Base Explorer"
                            onPress={() => Linking.openURL(getEtherscanUrl(txResult.hash, payment?.chain))}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="open-outline" size={20} color="#fff" />}
                            style={{ marginTop: SPACING.md }}
                        />

                        <GlassButton
                            title="New Payment"
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
    scanSection: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
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
        width: Dimensions.get('window').width - SPACING.lg * 2,
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
    walletSection: {
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
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
    demoHint: {
        color: COLORS.textMuted,
        fontSize: FONT.size.xs,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
});
