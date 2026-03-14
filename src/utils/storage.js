import AsyncStorage from '@react-native-async-storage/async-storage';

const TX_KEY = '@ethmum_transactions';

export async function saveTransaction(tx) {
    try {
        const existing = await getTransactions();
        const updated = [tx, ...existing];
        await AsyncStorage.setItem(TX_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn('Failed to save transaction:', e);
    }
}

export async function getTransactions() {
    try {
        const raw = await AsyncStorage.getItem(TX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('Failed to read transactions:', e);
        return [];
    }
}

export async function clearTransactions() {
    try {
        await AsyncStorage.removeItem(TX_KEY);
    } catch (e) {
        console.warn('Failed to clear transactions:', e);
    }
}
