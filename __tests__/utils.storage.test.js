import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTransaction, getTransactions, clearTransactions, TX_STORAGE_KEY } from '../src/utils/storage';

describe('storage.js Utilities', () => {
    beforeEach(() => {
        AsyncStorage.clear();
        jest.clearAllMocks();
    });

    it('should save a transaction successfully', async () => {
        const tx = { hash: '0x123', amount: '10' };
        await saveTransaction(tx);
        
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            TX_STORAGE_KEY, 
            expect.stringContaining('0x123')
        );
    });

    it('should retrieve empty transactions if none exist', async () => {
        AsyncStorage.getItem.mockResolvedValueOnce(null);
        const txs = await getTransactions();
        expect(txs).toEqual([]);
    });

    it('should retrieve parsed transactions', async () => {
        const mockTxs = [{ hash: '0x123' }, { hash: '0x456' }];
        AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockTxs));
        
        const txs = await getTransactions();
        expect(txs).toHaveLength(2);
        expect(txs[0].hash).toBe('0x123');
    });

    it('should clear all transactions', async () => {
        await clearTransactions();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TX_STORAGE_KEY);
    });
});
