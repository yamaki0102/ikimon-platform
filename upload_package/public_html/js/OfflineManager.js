class OfflineManager {
constructor() {
    this.dbName = 'ikimon_pwa_v1';
    this.storeName = 'outbox';
    this.db = null;

    // Auto-sync on online
    window.addEventListener('online', () => {
        console.log('[OfflineManager] Online detected, syncing...');
        this.sync();
    });

    // Sync on load if online
    if (navigator.onLine) {
        setTimeout(() => this.sync(), 3000);
    }
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
        const data = {};
        for (let [key, value] of formData.entries()) {
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

    // Refresh CSRF Token first if possible (global var via post.php)
    // If not available, we try anyway.
    let csrfToken = window.__POST_CONFIG ? window.__POST_CONFIG.csrfToken : '';

    for (const item of items) {
        try {
            const formData = new FormData();
            // Reconstruct FormData
            for (const key in item) {
                if (key === 'id' || key === 'status' || key === 'timestamp') continue;
                if (key === 'csrf_token' && csrfToken) {
                    formData.append('csrf_token', csrfToken); // Use fresh token
                    continue;
                }

                if (Array.isArray(item[key])) {
                    item[key].forEach(val => formData.append(key + '[]', val));
                } else {
                    formData.append(key, item[key]);
                }
            }

            // If no token in item and no fresh token, fetch one? (Too complex for now, assume config exists)

            const res = await fetch('api/post_observation.php', {
                method: 'POST',
                body: formData
            });

            // Handle non-JSON response gracefully
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.warn(`[OfflineManager] Server returned non-JSON for item ${item.id}`, text.slice(0, 100));
                continue; // Skip valid removal, try again later
            }

            if (json.success) {
                console.log(`[OfflineManager] Synced item ${item.id}`);
                await this.remove(item.id);
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                // Check for CSRF error
                if (json.message && json.message.includes('トークン')) {
                    console.warn(`[OfflineManager] CSRF Error for item ${item.id}. Keeping in queue.`);
                    // Ideally we fetch a new token here, but for now just skip removal
                } else {
                    // Other validation errors (e.g. Rate Limit, Validation)
                    // Log it but KEEP IT unless it's a permanent error?
                    // Safety first: Keep it. User can delete cache if stuck.
                    console.warn(`[OfflineManager] Sync failed for ${item.id}: ${json.message}. Keeping in queue.`);
                }
            }
        } catch (e) {
            // Network error — item stays in queue for next online attempt
            console.error(`[OfflineManager] Network error during sync for ${item.id}`, e);
        }
    }
}
}

// Export global instance
window.offlineManager = new OfflineManager();
