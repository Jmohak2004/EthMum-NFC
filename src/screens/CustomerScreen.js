import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    Linking,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { COLORS, SPACING, RADIUS, FONT, GRADIENTS, SHADOWS } from '../theme';
import GlassButton from '../components/GlassButton';
import NfcPulse from '../components/NfcPulse';
import PaymentCard from '../components/PaymentCard';
import { sendETH, sendUSDC, getEtherscanUrl } from '../utils/wallet';
import { saveTransaction } from '../utils/storage';

export default function CustomerScreen() {
    const [payment, setPayment] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [sending, setSending] = useState(false);
    const [txResult, setTxResult] = useState(null);

    const readNfc = useCallback(async () => {
        try {
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

    useEffect(() => {
        readNfc();
    }, []);

    const confirmPayment = useCallback(async () => {
        if (!payment) return;

        try {
            setSending(true);

            let result;
            if (payment.token === 'ETH') {
                result = await sendETH(payment.wallet, payment.amount);
            } else {
                result = await sendUSDC(payment.wallet, payment.amount);
            }

            result.merchant = payment.merchant;
            setTxResult(result);

            await saveTransaction(result);

            Alert.alert(
                '✅ Payment Sent!',
                `Tx: ${result.hash.slice(0, 10)}...`,
                [
                    { text: 'View on Etherscan', onPress: () => Linking.openURL(getEtherscanUrl(result.hash)) },
                    { text: 'OK' },
                ]
            );
        } catch (e) {
            console.warn('Transaction Error:', e);
            Alert.alert(
                '❌ Transaction Failed',
                e?.message || 'Could not send transaction. Check wallet balance.',
            );
        } finally {
            setSending(false);
        }
    }, [payment]);

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
                {!payment && (
                    <View style={styles.scanSection}>
                        <NfcPulse
                            active={scanning}
                            color={COLORS.secondary}
                            size={90}
                        />
                        <Text style={styles.scanLabel}>
                            {scanning ? 'Scanning for NFC...' : 'Tap to scan again'}
                        </Text>
                        {!scanning && (
                            <GlassButton
                                title="Scan NFC"
                                onPress={readNfc}
                                gradient={[COLORS.secondary, '#b388ff']}
                                icon={<Ionicons name="radio-outline" size={20} color="#fff" />}
                                style={{ marginTop: SPACING.lg }}
                            />
                        )}
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
                            wallet={payment.wallet}
                            amount={payment.amount}
                            token={payment.token}
                        />

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

                        <GlassButton
                            title="Cancel"
                            onPress={() => { setPayment(null); readNfc(); }}
                            gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            icon={<Ionicons name="close" size={20} color={COLORS.textSecondary} />}
                            style={{ marginTop: SPACING.sm }}
                        />
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
                        />

                        <GlassButton
                            title="View on Etherscan"
                            onPress={() => Linking.openURL(getEtherscanUrl(txResult.hash))}
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
});
