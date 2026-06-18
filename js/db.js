/**
 * db.js — طبقة البيانات
 * تخزين البلاغات في localStorage
 * يمكن استبدالها بـ Firebase / Supabase / أي API خارجي
 */

const DB_KEY = 'disability_parking_reports';

const DB = {

  /* ── قراءة جميع البلاغات ── */
  getAll() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : this._seed();
    } catch { return this._seed(); }
  },

  /* ── بلاغ واحد بالمعرّف ── */
  getById(id) {
    return this.getAll().find(r => r.id === id) || null;
  },

  /* ── حفظ بلاغ جديد ── */
  save(report) {
    const all = this.getAll();
    const entry = {
      id:       Date.now().toString(),
      name:     report.name     || 'موقف غير مسمى',
      notes:    report.notes    || '',
      lat:      report.lat,
      lng:      report.lng,
      photo:    report.photo    || null,   // base64 string
      status:   'pending',
      createdAt: new Date().toISOString(),
      address:  report.address  || '',
    };
    all.unshift(entry);
    localStorage.setItem(DB_KEY, JSON.stringify(all));
    return entry;
  },

  /* ── تحديث الحالة ── */
  updateStatus(id, status) {
    const all = this.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return false;
    all[idx].status = status;
    all[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(DB_KEY, JSON.stringify(all));
    return all[idx];
  },

  /* ── حذف بلاغ ── */
  delete(id) {
    const all = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(all));
  },

  /* ── بيانات أولية تجريبية ── */
  _seed() {
    const seed = [
      {
        id: 's1',
        name: 'مستشفى الملك فهد',
        notes: 'موقفان أمام مدخل الطوارئ مباشرةً',
        lat: 24.7136, lng: 46.6753,
        photo: null,
        status: 'approved',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        address: 'شارع العليا، الرياض',
      },
      {
        id: 's2',
        name: 'مركز تسوق النخيل',
        notes: 'ثلاثة مواقف قرب المصعد الرئيسي',
        lat: 24.7200, lng: 46.6820,
        photo: null,
        status: 'pending',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        address: 'طريق الملك فهد، الرياض',
      },
      {
        id: 's3',
        name: 'بلدية الرياض',
        notes: 'موقف واحد بجانب المدخل الرئيسي',
        lat: 24.7080, lng: 46.6700,
        photo: null,
        status: 'approved',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        address: 'وسط المدينة، الرياض',
      },
      {
        id: 's4',
        name: 'حديقة السلام',
        notes: '',
        lat: 24.7250, lng: 46.6650,
        photo: null,
        status: 'rejected',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        address: 'حي النزهة، الرياض',
      },
    ];
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  },

  /* ── إحصائيات ── */
  stats() {
    const all = this.getAll();
    return {
      total:    all.length,
      approved: all.filter(r => r.status === 'approved').length,
      pending:  all.filter(r => r.status === 'pending').length,
    };
  },
};
