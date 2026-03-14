import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT, SHADOWS } from '../theme';
import { shortenAddress } from '../utils/wallet';

export default function PaymentCard({ merchant, wallet, amount, token, txHash, timestamp }) {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.merchantBadge}>
                        <Ionicons name="storefront" size={18} color={COLORS.primary} />
                        <Text style={styles.merchantName}>{merchant || 'Unknown'}</Text>
                    </View>
                    <View style={styles.tokenBadge}>
                        <Text style={styles.tokenText}>{token || 'USDC'}</Text>
                    </View>
                </View>

                {/* Amount */}
                <View style={styles.amountContainer}>
                    <Text style={styles.currency}>$</Text>
                    <Text style={styles.amount}>{amount || '0'}</Text>
                </View>

                {/* Wallet */}
                <View style={styles.row}>
                    <Ionicons name="wallet-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.walletText}>
                        {wallet ? shortenAddress(wallet) : '—'}
                    </Text>
                </View>

                {/* Tx hash (if exists) */}
                {txHash ? (
                    <View style={styles.row}>
                        <Ionicons name="link-outline" size={14} color={COLORS.success} />
                        <Text style={[styles.walletText, { color: COLORS.success }]}>
                            {shortenAddress(txHash)}
                        </Text>
                    </View>
                ) : null}

                {/* Timestamp */}
                {timestamp ? (
                    <Text style={styles.timestamp}>
                        {new Date(timestamp).toLocaleString()}
                    </Text>
                ) : null}

                {/* Decoration dots */}
                <View style={styles.dotsRow}>
                    {[COLORS.primary, COLORS.secondary, COLORS.success].map((c, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                    ))}
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.card,
        marginBottom: SPACING.md,
    },
    gradient: {
        padding: SPACING.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    merchantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    merchantName: {
        color: COLORS.text,
        fontSize: FONT.size.lg,
        ...FONT.semibold,
    },
    tokenBadge: {
        backgroundColor: COLORS.primaryDim,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.full,
    },
    tokenText: {
        color: COLORS.primary,
        fontSize: FONT.size.sm,
        ...FONT.bold,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.lg,
    },
    currency: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.xl,
        ...FONT.light,
        marginTop: 4,
        marginRight: 4,
    },
    amount: {
        color: COLORS.text,
        fontSize: FONT.size.hero,
        ...FONT.bold,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    walletText: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        fontFamily: 'monospace',
    },
    timestamp: {
        color: COLORS.textMuted,
        fontSize: FONT.size.xs,
        marginTop: SPACING.sm,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: SPACING.md,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
