# مواقف ذوي الإعاقة — دليل الإعداد

## هيكل الملفات
```
parking-app/
├── index.html        ← الصفحة الرئيسية
├── css/
│   └── style.css     ← التصميم
├── js/
│   ├── db.js         ← قاعدة البيانات (localStorage)
│   └── app.js        ← المنطق الرئيسي + Google Maps
└── README.md
```

---

## ⚡ خطوات التشغيل السريع

### 1. الحصول على مفتاح Google Maps API

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروعاً جديداً أو اختر مشروعاً موجوداً
3. فعّل هذه المكتبات:
   - **Maps JavaScript API**
   - **Geocoding API**
   - **Places API**
4. اذهب إلى **APIs & Services → Credentials** وأنشئ **API Key**
5. قيّد المفتاح بـ HTTP referrers (اختياري للحماية)

### 2. وضع المفتاح في الكود

افتح `index.html` وابحث عن السطر:
```js
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
```
استبدل `YOUR_GOOGLE_MAPS_API_KEY` بمفتاحك.

ثم ابحث عن سطر تحميل المكتبة:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&...">
```
واستبدل `YOUR_GOOGLE_MAPS_API_KEY` هناك أيضاً.

### 3. إنشاء Map ID (للماركرز المتقدمة)

1. في Google Cloud Console اذهب إلى **Maps → Map Management**
2. أنشئ Map ID جديد (نوع: JavaScript)
3. في `app.js` استبدل `'DEMO_MAP_ID'` بالـ ID الذي أنشأته

### 4. تشغيل التطبيق

```bash
# استخدم أي خادم محلي بسيط، مثلاً:
npx serve .
# أو
python -m http.server 8080
```
ثم افتح `http://localhost:8080`

---

## 🗄️ ترقية قاعدة البيانات

حالياً التطبيق يستخدم `localStorage` — مناسب للتطوير.

### للإنتاج: Firebase Firestore

استبدل ملف `db.js` بهذا الكود:

```js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';

const app = initializeApp({ /* إعدادات Firebase */ });
const db = getFirestore(app);

const DB = {
  async getAll() {
    const snap = await getDocs(collection(db, 'reports'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async save(report) {
    return await addDoc(collection(db, 'reports'), { ...report, status: 'pending', createdAt: new Date() });
  },
  async updateStatus(id, status) {
    await updateDoc(doc(db, 'reports', id), { status, updatedAt: new Date() });
  },
};
```

---

## ✨ المميزات

| الميزة | الحالة |
|--------|--------|
| عرض الخريطة مع Google Maps | ✅ |
| ماركرز مخصصة (معتمد / قيد المراجعة) | ✅ |
| تحديد GPS تلقائي | ✅ |
| عكس الترميز الجغرافي (عنوان نصي) | ✅ |
| خريطة صغيرة في نموذج الإبلاغ | ✅ |
| رفع صورة الموقف | ✅ |
| لوحة إدارة (اعتماد / رفض) | ✅ |
| نافذة معلومات عند الضغط على الماركر | ✅ |
| تصميم متجاوب (جوال + سطح مكتب) | ✅ |
| RTL عربي كامل | ✅ |

---

## 🚀 الخطوات التالية المقترحة

- **مصادقة المستخدمين** — Firebase Auth
- **إشعارات** — عند اعتماد البلاغ
- **تطبيق جوال** — React Native أو Flutter
- **لوحة إدارة منفصلة** — للمشرفين
- **فلترة بالمنطقة** — البحث حسب المدينة
- **تصدير CSV** — لتقارير الإدارة
