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

export default function HistoryScreen() {
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
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
                if (item.hash) Linking.openURL(getEtherscanUrl(item.hash));
            }}
        >
            <PaymentCard
                merchant={item.merchant || 'Unknown'}
                wallet={item.to}
                amount={item.amount}
                token={item.token}
                txHash={item.hash}
                timestamp={item.timestamp}
            />
        </TouchableOpacity>
    );

    return (
        <LinearGradient colors={GRADIENTS.bg} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
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
                    keyExtractor={(_, i) => String(i)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
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
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
                    </View>
                    <Text style={styles.emptyText}>
                        Completed payments will appear here
                    </Text>
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
        paddingTop: Platform.OS === 'android' ? 50 : 60,
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
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: FONT.size.md,
        textAlign: 'center',
    },
});
