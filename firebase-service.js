/* ========================================
   MAP Supplies - Cloud Database Service (Firebase)
   نظام قاعدة بيانات سحابية للربط بين جميع الأجهزة
   ======================================== */

// استيراد مكتبات Firebase من CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyC-ADjmO2_xyN48u24CQe3nxdYbD5_odpM",
    authDomain: "map-supplies-55658.firebaseapp.com",
    projectId: "map-supplies-55658",
    storageBucket: "map-supplies-55658.firebasestorage.app",
    messagingSenderId: "202719020016",
    appId: "1:202719020016:web:83a58cac471d2468139335"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class MapCloudDatabase {
    constructor() {
        this.db = db;
    }

    /**
     * حفظ تعليمة برمجية لضمان عمل الخدمة
     */
    async init() {
        console.log("Firebase Cloud Database Connected ✅");
        return true;
    }

    /**
     * جلب جميع المستندات من مجموعة معينة
     */
    async getAll(collectionName) {
        try {
            const querySnapshot = await getDocs(collection(this.db, collectionName));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error getting ${collectionName}: `, error);
            return [];
        }
    }

    /**
     * جلب مستند واحد بالمعرف
     */
    async getById(collectionName, id) {
        try {
            const docRef = doc(this.db, collectionName, id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error(`Error getting document ${id}: `, error);
            return null;
        }
    }

    /**
     * إضافة أو تحديث مستند
     */
    async save(collectionName, data) {
        try {
            // نستخدم المعرف الموجود في البيانات كمعرف للمستند في Firebase
            const id = data.id;
            if (!id) throw new Error("Document ID is required");

            const docRef = doc(this.db, collectionName, id);
            await setDoc(docRef, data, { merge: true });
            return true;
        } catch (error) {
            console.error("Error saving document: ", error);
            return false;
        }
    }

    /**
     * حذف مستند
     */
    async delete(collectionName, id) {
        try {
            await deleteDoc(doc(this.db, collectionName, id));
            return true;
        } catch (error) {
            console.error("Error deleting document: ", error);
            return false;
        }
    }

    /**
     * مراقبة التغييرات الحية (Real-time)
     * تستخدم لتحديث الواجهة فور حدوث تغيير عند مستخدم آخر
     */
    subscribe(collectionName, callback) {
        return onSnapshot(collection(this.db, collectionName), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(data);
        });
    }

    /**
     * حفظ الإعدادات وقوالب الرسائل
     */
    async setSetting(key, value) {
        try {
            await setDoc(doc(this.db, 'settings', key), { value });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getSetting(key) {
        const docSnap = await getDoc(doc(this.db, 'settings', key));
        return docSnap.exists() ? docSnap.data().value : null;
    }
}

// تصدير نسخة عالمية للعمل في كل الصفحات
const MAP_CLOUD = new MapCloudDatabase();
window.MAP_CLOUD = MAP_CLOUD;
