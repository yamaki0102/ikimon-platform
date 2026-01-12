class OfflineManager {
    constructor() {
        this.dbName = 'ikimon_pwa_v1';
        this.storeName = 'outbox';
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
        });
    }

    async saveObservation(formData) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Convert FormData to plain object for storage
            // Note: Blobs are supported in IndexedDB
            const data = {};
            for (let [key, value] of formData.entries()) {
                // If it's a file array (photos[]), we need to handle it carefully
                // However, formData.entries() returns individual entries. 
                // We'll gather them into an array if key ends in []
                if (key.endsWith('[]')) {
                    const realKey = key.slice(0, -2);
                    if (!data[realKey]) data[realKey] = [];
                    data[realKey].push(value);
                } else {
                    data[key] = value;
                }
            }
            // Add metadata
            data.timestamp = Date.now();
            data.status = 'pending';

            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getCount() {
        await this.open();
        return new Promise(resolve => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    }

    async getAll() {
        await this.open();
        return new Promise(resolve => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve([]);
        });
    }

    async remove(id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async sync() {
        const items = await this.getAll();
        if (items.length === 0) return;

        console.log(`[OfflineManager] Syncing ${items.length} items...`);

        for (const item of items) {
            try {
                const formData = new FormData();
                // Reconstruct FormData
                for (const key in item) {
                    if (key === 'id' || key === 'status' || key === 'timestamp') continue;

                    if (Array.isArray(item[key])) {
                        item[key].forEach(val => formData.append(key + '[]', val)); // post.php expects photos[]
                    } else {
                        formData.append(key, item[key]);
                    }
                }

                const res = await fetch('api/post_observation.php', {
                    method: 'POST',
                    body: formData
                });
                const json = await res.json();

                if (json.success) {
                    console.log(`[OfflineManager] Synced item ${item.id}`);
                    await this.remove(item.id);
                    if (window.Toast) {
                        window.Toast.show('オフラインの投稿を送信しました', 'success');
                    }
                } else {
                    console.error(`[OfflineManager] Sync failed for ${item.id}`, json);
                    if (window.Toast) {
                        window.Toast.show('送信失敗: ' + (json.error || '不明なエラー'), 'error');
                    }
                }
            } catch (e) {
                console.error(`[OfflineManager] Network error during sync for ${item.id}`, e);
            }
        }
    }
}

// Export global instance
window.offlineManager = new OfflineManager();
