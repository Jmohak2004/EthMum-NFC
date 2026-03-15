import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    TouchableOpacity,
    Linking,
    Alert,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT, GRADIENTS, SHADOWS } from '../theme';
import PaymentCard from '../components/PaymentCard';
import GlassButton from '../components/GlassButton';
import { getTransactions, clearTransactions } from '../utils/storage';
import { getEtherscanUrl } from '../utils/wallet';
import { getChainConfig } from '../config/blockchain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_EXTRA_PADDING, MIN_TOUCH_TARGET } from '../utils/responsive';

export default function HistoryScreen() {
    const insets = useSafeAreaInsets();
    const [transactions, setTransactions] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadTransactions = useCallback(async () => {
        const txs = await getTransactions();
        setTransactions(txs);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTransactions();
        }, [loadTransactions])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTransactions();
        setRefreshing(false);
    };

    const handleClear = () => {
        Alert.alert('Clear History', 'Remove all transaction records?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                    await clearTransactions();
                    setTransactions([]);
                },
            },
        ]);
    };

    const renderItem = ({ item }) => (
        <View style={styles.historyItem}>
            <PaymentCard
                counterparty={item.receiverName || item.merchant || 'Unknown'}
                wallet={item.to}
                amount={item.amount}
                token={item.token}
                txHash={item.hash}
                timestamp={item.timestamp}
                chain={item.chain}
                ensName={item.ensName}
            />
            {item.hash && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.explorerBtn}
                    onPress={() => Linking.openURL(getEtherscanUrl(item.hash, item.chain))}
                >
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.explorerBtnText}>
                        View on {item.chain ? getChainConfig(item.chain).name : 'Sepolia'} Explorer
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + SPACING.sm }]}>
                <View style={styles.titleRow}>
                    <Ionicons name="time-outline" size={28} color={COLORS.warning} />
                    <Text style={styles.title}>History</Text>
                </View>
                {transactions.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.subtitle}>
                {transactions.length
                    ? `${transactions.length} transaction${transactions.length > 1 ? 's' : ''}`
                    : 'No transactions yet'}
            </Text>

            {/* List */}
            {transactions.length > 0 ? (
                <FlatList
                    data={transactions}
                    keyExtractor={(item, index) => item.hash || `tx-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.list,
                        { paddingBottom: insets.bottom + TAB_BAR_EXTRA_PADDING },
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={[styles.emptyState, { paddingBottom: insets.bottom + 60 }]}>
                    <View style={styles.spendingNote}>
                        <View style={styles.spendingNoteIcon}>
                            <Ionicons name="receipt-outline" size={24} color={COLORS.textDark} />
                        </View>
                        <Text style={styles.spendingBody}>
                            Completed payments will appear here. <Text style={styles.spendingBold}>Pull down</Text> or tap below to refresh.
                        </Text>
                    </View>
                    <GlassButton
                        title="Pull to Refresh"
                        onPress={onRefresh}
                        gradient={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                        icon={<Ionicons name="refresh" size={18} color={COLORS.textSecondary} />}
                        style={{ marginTop: SPACING.lg }}
                    />
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    title: {
        color: COLORS.text,
        fontSize: FONT.size.xxl,
        ...FONT.bold,
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT.size.md,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        marginTop: SPACING.xs,
    },
    clearBtn: {
        padding: SPACING.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.dangerDim,
        borderRadius: RADIUS.full,
    },
    list: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: 120,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    spendingNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: COLORS.yellowLight,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
    },
    spendingNoteIcon: {
        width: 40,
        height: 40,
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
        textAlign: 'center',
    },
    spendingBold: {
        fontWeight: '700',
        color: COLORS.textDark,
    },
    historyItem: {
        marginBottom: SPACING.sm,
    },
    explorerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        minHeight: 44,
        backgroundColor: COLORS.primaryDim,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
        borderRadius: RADIUS.full,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        marginTop: -SPACING.xs,
        marginBottom: SPACING.sm,
    },
    explorerBtnText: {
        color: COLORS.primary,
        fontSize: FONT.size.sm,
        ...FONT.medium,
    },
});
