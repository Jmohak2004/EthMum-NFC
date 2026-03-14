import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT, SHADOWS } from '../theme';
import { shortenAddress } from '../utils/wallet';
import { getChainConfig } from '../config/blockchain';

export default function PaymentCard({ merchant, wallet, amount, token, txHash, timestamp, ensName, avatar, chain, textRecords }) {
    const hasProfile = textRecords && Object.keys(textRecords).length > 0;
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* ENS Profile Section */}
                {ensName && (
                    <View style={styles.ensProfile}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Ionicons name="person" size={24} color={COLORS.primary} />
                            </View>
                        )}
                        <View style={styles.ensInfo}>
                            <Text style={styles.ensName}>{ensName}</Text>
                            {wallet && (
                                <Text style={styles.ensAddress}>{shortenAddress(wallet)}</Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.merchantBadge}>
                        <Ionicons name="storefront" size={18} color={COLORS.primary} />
                        <Text style={styles.merchantName}>{merchant || 'Unknown'}</Text>
                    </View>
                    <View style={styles.badgeRow}>
                        {chain && (
                            <View style={[styles.tokenBadge, { backgroundColor: COLORS.secondaryDim }]}>
                                <Text style={[styles.tokenText, { color: COLORS.secondary }]}>{getChainConfig(chain).name}</Text>
                            </View>
                        )}
                        <View style={styles.tokenBadge}>
                            <Text style={styles.tokenText}>{token || 'USDC'}</Text>
                        </View>
                    </View>
                </View>

                {/* Amount */}
                <View style={styles.amountContainer}>
                    <Text style={styles.currency}>$</Text>
                    <Text style={styles.amount}>{amount || '0'}</Text>
                </View>

                {/* Wallet (when no ENS) */}
                {!ensName && (
                    <View style={styles.row}>
                        <Ionicons name="wallet-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.walletText}>
                            {wallet ? shortenAddress(wallet) : '—'}
                        </Text>
                    </View>
                )}

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

                {/* Merchant Profile (ENS Text Records) */}
                {hasProfile && (
                    <View style={styles.profileSection}>
                        <View style={styles.profileHeader}>
                            <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
                            <Text style={styles.profileTitle}>Merchant Profile</Text>
                        </View>
                        {textRecords.description && (
                            <Text style={styles.profileDescription}>{textRecords.description}</Text>
                        )}
                        <View style={styles.profileLinks}>
                            {textRecords.url && (
                                <TouchableOpacity
                                    style={styles.profileChip}
                                    onPress={() => {
                                        const url = textRecords.url.startsWith('http') ? textRecords.url : `https://${textRecords.url}`;
                                        Linking.openURL(url);
                                    }}
                                >
                                    <Ionicons name="globe-outline" size={12} color={COLORS.primary} />
                                    <Text style={styles.profileChipText}>{textRecords.url}</Text>
                                </TouchableOpacity>
                            )}
                            {textRecords['com.twitter'] && (
                                <TouchableOpacity
                                    style={styles.profileChip}
                                    onPress={() => {
                                        const handle = textRecords['com.twitter'].replace('@', '');
                                        Linking.openURL(`https://twitter.com/${handle}`);
                                    }}
                                >
                                    <Ionicons name="logo-twitter" size={12} color="#1DA1F2" />
                                    <Text style={[styles.profileChipText, { color: '#1DA1F2' }]}>
                                        {textRecords['com.twitter'].startsWith('@') ? textRecords['com.twitter'] : `@${textRecords['com.twitter']}`}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {textRecords['com.github'] && (
                                <TouchableOpacity
                                    style={styles.profileChip}
                                    onPress={() => Linking.openURL(`https://github.com/${textRecords['com.github']}`)}
                                >
                                    <Ionicons name="logo-github" size={12} color={COLORS.textSecondary} />
                                    <Text style={styles.profileChipText}>{textRecords['com.github']}</Text>
                                </TouchableOpacity>
                            )}
                            {textRecords.email && (
                                <TouchableOpacity
                                    style={styles.profileChip}
                                    onPress={() => Linking.openURL(`mailto:${textRecords.email}`)}
                                >
                                    <Ionicons name="mail-outline" size={12} color={COLORS.warning} />
                                    <Text style={[styles.profileChipText, { color: COLORS.warning }]}>{textRecords.email}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

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
    ensProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.lg,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.glassBorder,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primaryDim,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ensInfo: {
        flex: 1,
    },
    ensName: {
        color: COLORS.primary,
        fontSize: FONT.size.lg,
        ...FONT.bold,
    },
    ensAddress: {
        color: COLORS.textMuted,
        fontSize: FONT.size.xs,
        fontFamily: 'monospace',
        marginTop: 2,
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
    badgeRow: {
        flexDirection: 'row',
        gap: SPACING.xs,
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
    profileSection: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    profileTitle: {
        color: COLORS.primary,
        fontSize: FONT.size.sm,
        ...FONT.bold,
    },
    profileDescription: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.sm,
        lineHeight: 18,
        marginBottom: SPACING.sm,
    },
    profileLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    profileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.glass,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
    },
    profileChipText: {
        color: COLORS.primary,
        fontSize: FONT.size.xs,
        ...FONT.medium,
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
