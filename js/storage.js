const STORAGE_KEY = 'kewa_trade_tracker_v1';

const Storage = {
    getTrades() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return [];
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            console.warn('Stored data is not an array. Resetting safely.');
            return [];
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return [];
        }
    },

    saveTrades(trades) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
            return true;
        } catch (e) {
            console.error('Error writing to localStorage (Quota exceeded or restricted):', e);
            alert('⚠️ Storage Error: Unable to save changes locally. Storage quota may be exceeded.');
            return false;
        }
    }
};
