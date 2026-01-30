/* ========================================
   MAP Supplies - Database Service (IndexedDB)
   نظام قاعدة بيانات احترافي لتخزين البيانات محلياً
   ======================================== */

class MapDatabase {
    constructor() {
        this.dbName = 'MAP_Supplies_DB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * تهيئة قاعدة البيانات
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: " + event.target.errorCode);
                reject("فشل فتح قاعدة البيانات");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Database initialized successfully");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // إنشاء مخازن البيانات (Tables)
                if (!db.objectStoreNames.contains('customers')) {
                    const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
                    customerStore.createIndex('email', 'email', { unique: true });
                }

                if (!db.objectStoreNames.contains('orders')) {
                    const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
                    orderStore.createIndex('customerId', 'customerId', { unique: false });
                }

                if (!db.objectStoreNames.contains('quotes')) {
                    const quoteStore = db.createObjectStore('quotes', { keyPath: 'id' });
                    quoteStore.createIndex('orderId', 'orderId', { unique: false });
                }

                if (!db.objectStoreNames.contains('supervisors')) {
                    db.createObjectStore('supervisors', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('notifications')) {
                    db.createObjectStore('notifications', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log("Database upgrade completed");
                this.migrateFromLocalStorage(db);
            };
        });
    }

    /**
     * نقل البيانات القديمة من LocalStorage إلى IndexedDB
     */
    migrateFromLocalStorage(db) {
        console.log("Migrating data from LocalStorage...");
        const keys = {
            'admin_customers': 'customers',
            'admin_orders': 'orders',
            'admin_quotes': 'quotes',
            'admin_supervisors': 'supervisors',
            'admin_notifications': 'notifications'
        };

        const transaction = db.transaction(Object.values(keys), 'readwrite');

        for (const [lsKey, storeName] of Object.entries(keys)) {
            const data = JSON.parse(localStorage.getItem(lsKey) || '[]');
            const store = transaction.objectStore(storeName);
            data.forEach(item => {
                if (item.id) store.put(item);
            });
        }

        // Settings
        const settingsStore = db.transaction('settings', 'readwrite').objectStore('settings');
        const template = localStorage.getItem('admin_notificationTemplate');
        if (template) settingsStore.put({ key: 'admin_notificationTemplate', value: template });

        console.log("Migration finished");
    }

    /**
     * عمليات CRUD العامة
     */
    async getAll(storeName) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getById(storeName, id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(false);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
        });
    }

    async clearStore(storeName) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
        });
    }

    // دوال خاصة بالإعدادات والجسات
    async getSetting(key) {
        const result = await this.getById('settings', key);
        return result ? result.value : null;
    }

    async setSetting(key, value) {
        return this.save('settings', { key, value });
    }
}

// تصدير نسخة واحدة لاستخدامها في كل مكان
const MAP_DB = new MapDatabase();
window.MAP_DB = MAP_DB;
