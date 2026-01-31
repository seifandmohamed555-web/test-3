/* ========================================
   MAP Supplies - Cloud Database Service (Compat Version)
   نظام قاعدة بيانات سحابية متوافق كلياً مع جميع الأجهزة
   ======================================== */

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyC-ADjmO2_xyN48u24CQe3nxdYbD5_odpM",
    authDomain: "map-supplies-55658.firebaseapp.com",
    projectId: "map-supplies-55658",
    storageBucket: "map-supplies-55658.firebasestorage.app",
    messagingSenderId: "202719020016",
    appId: "1:202719020016:web:83a58cac471d2468139335"
};

// تهيئة Firebase في النطاق العالمي
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

class MapCloudDatabase {
    constructor() {
        this.db = db;
    }

    async init() {
        console.log("Firebase Cloud Connected Globally ✅");
        return true;
    }

    async getAll(collectionName) {
        try {
            const querySnapshot = await this.db.collection(collectionName).get();
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error getting ${collectionName}: `, error);
            return [];
        }
    }

    async getById(collectionName, id) {
        try {
            const doc = await this.db.collection(collectionName).doc(id).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            return null;
        }
    }

    async save(collectionName, data) {
        try {
            if (!data.id) throw new Error("ID required");
            await this.db.collection(collectionName).doc(data.id).set(data, { merge: true });
            return true;
        } catch (error) {
            console.error("Save error: ", error);
            return false;
        }
    }

    async delete(collectionName, id) {
        try {
            await this.db.collection(collectionName).doc(id).delete();
            return true;
        } catch (error) {
            return false;
        }
    }

    subscribe(collectionName, callback) {
        return this.db.collection(collectionName).onSnapshot((snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(data);
        });
    }

    async setSetting(key, value) {
        try {
            await this.db.collection('settings').doc(key).set({ value });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getSetting(key) {
        try {
            const doc = await this.db.collection('settings').doc(key).get();
            return doc.exists ? doc.data().value : null;
        } catch (error) {
            return null;
        }
    }
}

// جعل المحرك متاحاً بشكل عالمي وفوري
window.MAP_CLOUD = new MapCloudDatabase();
