/**
 * db.js — قاعدة البيانات
 * Firebase Firestore — مشتركة بين جميع الأجهزة
 */

// ── إعداد Firebase ──
const firebaseConfig = {
  apiKey: "AIzaSyAS89CpvwHicZvoPhlUtwdK_DQnIDTkMPw",
  authDomain: "project-a30624b9-3987-4a56-af3.firebaseapp.com",
  projectId: "project-a30624b9-3987-4a56-af3",
  storageBucket: "project-a30624b9-3987-4a56-af3.firebasestorage.app",
  messagingSenderId: "427917552528",
  appId: "1:427917552528:web:6d586dda8cc495e7656115",
  measurementId: "G-B3VJ806VCT"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COLLECTION = 'reports';

const DB = {

  /* ── قراءة جميع البلاغات ── */
  async getAll() {
    try {
      const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) {
      console.error('getAll error:', e);
      return [];
    }
  },

  /* ── بلاغ واحد بالمعرّف ── */
  async getById(id) {
    try {
      const doc = await db.collection(COLLECTION).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch(e) { return null; }
  },

  /* ── حفظ بلاغ جديد ── */
  async save(report) {
    try {
      const entry = {
        name:      report.name     || 'موقف غير مسمى',
        notes:     report.notes    || '',
        lat:       report.lat,
        lng:       report.lng,
        photo:     report.photo    || null,
        status:    'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        address:   report.address  || '',
      };
      const ref = await db.collection(COLLECTION).add(entry);
      return { id: ref.id, ...entry, createdAt: new Date().toISOString() };
    } catch(e) {
      console.error('save error:', e);
      return null;
    }
  },

  /* ── تحديث الحالة ── */
  async updateStatus(id, status) {
    try {
      await db.collection(COLLECTION).doc(id).update({
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const doc = await db.collection(COLLECTION).doc(id).get();
      return { id: doc.id, ...doc.data() };
    } catch(e) {
      console.error('updateStatus error:', e);
      return null;
    }
  },

  /* ── تحديث بيانات الموقف (للتعديل) ── */
  async update(id, data) {
    try {
      await db.collection(COLLECTION).doc(id).update({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    } catch(e) {
      console.error('update error:', e);
      return false;
    }
  },

  /* ── حذف بلاغ ── */
  async delete(id) {
    try {
      await db.collection(COLLECTION).doc(id).delete();
      return true;
    } catch(e) {
      console.error('delete error:', e);
      return false;
    }
  },

  /* ── إحصائيات ── */
  async stats() {
    const all = await this.getAll();
    return {
      total:    all.length,
      approved: all.filter(r => r.status === 'approved').length,
      pending:  all.filter(r => r.status === 'pending').length,
    };
  },
};
