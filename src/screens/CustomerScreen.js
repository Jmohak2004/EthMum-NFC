import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Alert,
    Linking,
    Platform,
    ActivityIndicator,
    Dimensions,
    TouchableOpacity,
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
    getEtherscanUrl, resolveENSProfile, resolveRecipient,
    sendETHViaProvider, sendUSDCViaProvider, shortenAddress,
} from '../utils/wallet';
import { saveTransaction } from '../utils/storage';
import { ethers } from 'ethers';
import { CHAINS, CHAIN_KEYS, DEFAULT_CHAIN, getChainConfig, RECEIVER_ADDRESS } from '../config/blockchain';
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

    // NFC hardcoded flow: user enters amount after tag detected
    const [nfcAmountInput, setNfcAmountInput] = useState('');
    const [nfcToken, setNfcToken] = useState('USDC');
    const [nfcChain, setNfcChain] = useState(DEFAULT_CHAIN);

    // Pay via ENS/Address (manual)
    const [showEnsForm, setShowEnsForm] = useState(false);
    const [ensRecipient, setEnsRecipient] = useState('');
    const [ensAmount, setEnsAmount] = useState('');
    const [ensToken, setEnsToken] = useState('USDC');
    const [ensChain, setEnsChain] = useState(DEFAULT_CHAIN);
    const [resolvingRecipient, setResolvingRecipient] = useState(false);

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

            if (!tag) {
                Alert.alert('NFC Error', 'Could not read tag.');
                return;
            }

            // Hardcoded flow: any tag detected → "Connection successful" → use hardcoded receiver address
            if (!RECEIVER_ADDRESS || !ethers.isAddress(RECEIVER_ADDRESS)) {
                Alert.alert(
                    'Receiver Not Configured',
                    'Add HARDCODED_RECEIVER_ADDRESS to your .env file to use the NFC payment flow.',
                );
                return;
            }

            setScanning(false);
            try {
                await NfcManager.cancelTechnologyRequest();
            } catch (_) { }

            Alert.alert(
                '✅ Connection Successful',
                `Receiver address: ${shortenAddress(RECEIVER_ADDRESS)}\n\nEnter the amount to send.`,
                [{ text: 'OK' }],
            );

            setPayment({
                mode: 'receive-profile',
                fromNfcHardcoded: true,
                wallet: RECEIVER_ADDRESS,
                receiverName: 'Receiver',
                preferredToken: nfcToken,
                preferredChain: nfcChain,
                suggestedAmount: '',
            });
            setNfcAmountInput('');
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
    }, [senderReady, nfcToken, nfcChain]);

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

    const handleQrScanned = useCallback((event) => {
        if (qrScannedRef.current) return;
        const raw = typeof event === 'string' ? event : (event?.data ?? event?.raw ?? '');
        const data = String(raw || '').trim();
        if (!data) {
            qrScannedRef.current = true;
            setQrScanning(false);
            return;
        }
        qrScannedRef.current = true;
        try {
            const receiverProfile = parseReceiverProfile(data);
            setQrScanning(false);
            setPayment(receiverProfile);
        } catch (_) {
            const trimmed = data;
            const isEns = trimmed.toLowerCase().endsWith('.eth');
            const isAddress = ethers.isAddress(trimmed);
            if (isEns || isAddress) {
                setQrScanning(false);
                setEnsRecipient(trimmed);
                setEnsAmount('');
                setShowEnsForm(true);
            } else {
                Alert.alert('Invalid QR', 'Scan a payment QR from the Receive tab, or a QR containing an ENS name (e.g. name.eth) or wallet address.');
                setQrScanning(false);
            }
        }
    }, [parseReceiverProfile]);

    const handleEnsFormSubmit = useCallback(async () => {
        if (!senderReady) return;
        const recipient = (ensRecipient || '').trim();
        if (!recipient) {
            Alert.alert('Missing Recipient', 'Enter an ENS name (e.g. vitalik.eth) or wallet address (0x...).');
            return;
        }
        if (!ensAmount || !/^\d+(\.\d+)?$/.test(ensAmount) || parseFloat(ensAmount) <= 0) {
            Alert.alert('Invalid Amount', 'Enter a valid amount (e.g. 1.50).');
            return;
        }
        setResolvingRecipient(true);
        try {
            const resolved = await resolveRecipient(recipient);
            if (!resolved) {
                Alert.alert('Invalid Recipient', 'Could not resolve this ENS name or address. Check the input and try again.');
                return;
            }
            const paymentData = {
                mode: 'receive-profile',
                receiverName: resolved.ens || shortenAddress(resolved.wallet),
                wallet: resolved.wallet,
                ens: resolved.ens || undefined,
                suggestedAmount: ensAmount,
                preferredToken: ensToken,
                preferredChain: ensChain,
            };
            setPayment(paymentData);
            setShowEnsForm(false);
            setEnsRecipient('');
            setEnsAmount('');
        } catch (e) {
            Alert.alert('Error', e?.message || 'Could not resolve recipient.');
        } finally {
            setResolvingRecipient(false);
        }
    }, [senderReady, ensRecipient, ensAmount, ensToken, ensChain]);

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
            const chainKey = payment.preferredChain || payment.chain || DEFAULT_CHAIN;

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
        const chainName = getChainConfig(payment.preferredChain || payment.chain || DEFAULT_CHAIN).name;
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

                {/* Pay to ENS / Address Form */}
                {showEnsForm && !payment && (
                    <View style={styles.ensFormCard}>
                        <View style={styles.panelHandle} />
                        <Text style={styles.formTitle}>Pay to ENS or Address</Text>
                        <Text style={styles.label}>Recipient (ENS or 0x...)</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
                            <TextInput
                                style={styles.input}
                                value={ensRecipient}
                                onChangeText={setEnsRecipient}
                                placeholder="vitalik.eth or 0x..."
                                placeholderTextColor={COLORS.textMuted}
                                autoCapitalize="none"
                            />
                        </View>
                        <Text style={styles.label}>Amount</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.dollarSign}>$</Text>
                            <TextInput
                                style={[styles.input, styles.amountInput]}
                                value={ensAmount}
                                onChangeText={setEnsAmount}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        <Text style={styles.label}>Token</Text>
                        <View style={styles.chipRow}>
                            {['USDC', 'ETH'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setEnsToken(t)}
                                    style={[styles.chip, ensToken === t && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, ensToken === t && styles.chipTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.label}>Network</Text>
                        <View style={styles.chipRow}>
                            {CHAIN_KEYS.map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => setEnsChain(key)}
                                    style={[styles.chip, ensChain === key && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, ensChain === key && styles.chipTextActive]}>{CHAINS[key].name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <GlassButton
                            title={resolvingRecipient ? 'Resolving...' : 'Continue'}
                            onPress={handleEnsFormSubmit}
                            gradient={GRADIENTS.primary}
                            disabled={resolvingRecipient || !senderReady}
                            icon={<Ionicons name="arrow-forward" size={20} color={COLORS.textDark} />}
                            style={{ marginTop: SPACING.lg }}
                        />
                        <GlassButton
                            title="Back"
                            onPress={() => { setShowEnsForm(false); setEnsRecipient(''); setEnsAmount(''); }}
                            gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            icon={<Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />}
                            style={{ marginTop: SPACING.sm }}
                        />
                    </View>
                )}

                {/* NFC Scan Area */}
                {!payment && !qrScanning && !showEnsForm && (
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
                                    <View style={styles.divider}>
                                        <View style={styles.dividerLine} />
                                        <Text style={styles.dividerText}>OR</Text>
                                        <View style={styles.dividerLine} />
                                    </View>
                                    <GlassButton
                                        title="Pay to ENS or Address"
                                        onPress={() => setShowEnsForm(true)}
                                        gradient={GRADIENTS.primary}
                                        icon={<Ionicons name="at-outline" size={20} color={COLORS.textDark} />}
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

                {/* NFC Hardcoded: amount form (user enters amount before confirming) */}
                {payment?.fromNfcHardcoded && !payment?.suggestedAmount && !txResult && (
                    <View style={styles.ensFormCard}>
                        <View style={styles.panelHandle} />
                        <Text style={styles.formTitle}>Enter Amount to Send</Text>
                        <Text style={styles.label}>Receiver</Text>
                        <Text style={[styles.input, { backgroundColor: 'transparent', paddingVertical: SPACING.sm }]}>{shortenAddress(payment.wallet)}</Text>
                        <Text style={styles.label}>Amount</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.dollarSign}>$</Text>
                            <TextInput
                                style={[styles.input, styles.amountInput]}
                                value={nfcAmountInput}
                                onChangeText={setNfcAmountInput}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        <Text style={styles.label}>Token</Text>
                        <View style={styles.chipRow}>
                            {['USDC', 'ETH'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setNfcToken(t)}
                                    style={[styles.chip, nfcToken === t && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, nfcToken === t && styles.chipTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.label}>Network</Text>
                        <View style={styles.chipRow}>
                            {CHAIN_KEYS.map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => setNfcChain(key)}
                                    style={[styles.chip, nfcChain === key && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, nfcChain === key && styles.chipTextActive]}>{CHAINS[key].name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <GlassButton
                            title="Continue"
                            onPress={() => {
                                if (!nfcAmountInput || !/^\d+(\.\d+)?$/.test(nfcAmountInput) || parseFloat(nfcAmountInput) <= 0) {
                                    Alert.alert('Invalid Amount', 'Enter a valid amount (e.g. 1.50).');
                                    return;
                                }
                                setPayment((prev) => ({
                                    ...prev,
                                    suggestedAmount: nfcAmountInput,
                                    preferredToken: nfcToken,
                                    preferredChain: nfcChain,
                                }));
                            }}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="arrow-forward" size={20} color={COLORS.textDark} />}
                            style={{ marginTop: SPACING.lg }}
                        />
                        <GlassButton
                            title="Cancel"
                            onPress={() => setPayment(null)}
                            gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            icon={<Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />}
                            style={{ marginTop: SPACING.sm }}
                        />
                    </View>
                )}

                {/* Payment Details (also when NFC hardcoded after amount entered) */}
                {payment && !txResult && (payment.suggestedAmount || !payment.fromNfcHardcoded) && (
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
                                        <Text style={styles.hashHint}>Tap to view on {getChainConfig(payment?.preferredChain || payment?.chain || DEFAULT_CHAIN).name} Explorer</Text>
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
                                onPress={() => setPayment(null)}
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
                            title={`View on ${getChainConfig(payment?.preferredChain || payment?.chain || DEFAULT_CHAIN).name} Explorer`}
                            onPress={() => Linking.openURL(getEtherscanUrl(txResult.hash, payment?.preferredChain || payment?.chain))}
                            gradient={GRADIENTS.primary}
                            icon={<Ionicons name="open-outline" size={20} color={COLORS.textDark} />}
                            style={{ marginTop: SPACING.md }}
                        />

                        <GlassButton
                            title="Send Another"
                            onPress={() => { setPayment(null); setTxResult(null); }}
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
    ensFormCard: {
        backgroundColor: COLORS.darkCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.darkBorder,
        width: '100%',
    },
    formTitle: {
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
    chipRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    chip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    chipActive: {
        backgroundColor: COLORS.primaryDim,
        borderColor: COLORS.primary,
    },
    chipText: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        ...FONT.medium,
    },
    chipTextActive: {
        color: COLORS.primary,
        ...FONT.bold,
    },
});
