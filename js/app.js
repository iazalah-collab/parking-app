/**
 * app.js — المنطق الرئيسي للتطبيق
 * Google Maps API + إدارة البلاغات
 */

// ← بيانات دخول المدير — غيّرها لما تريد
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'parking2024';

// ← رابط الـ Worker الخاص بك على Cloudflare
const WORKER_URL = 'https://maps-resolver.i-a-zalah.workers.dev';

/* ═══════════════════════════════════════
   الحالة العامة
═══════════════════════════════════════ */
let map = null;
let markers = {};
let miniMap = null;
let miniMarker = null;
let currentLat = null;
let currentLng = null;
let currentAddress = '';
let photoData = null;
let currentMethod = 'gps';
let pickMap = null;
let pickMarker = null;

/* ═══════════════════════════════════════
   تسجيل دخول الإدارة
═══════════════════════════════════════ */
let isAdminLoggedIn = false;

function handleAdminTab(el) {
  switchTab('admin', el);
  if (isAdminLoggedIn) {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminContent').classList.remove('hidden');
    renderAdmin();
  } else {
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('adminContent').classList.add('hidden');
  }
}

function doLogin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value;
  const errEl = document.getElementById('loginError');

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    isAdminLoggedIn = true;
    errEl.classList.add('hidden');
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminContent').classList.remove('hidden');
    renderAdmin();
    showToast('✅ مرحباً بك في لوحة الإدارة');
  } else {
    errEl.classList.remove('hidden');
    document.getElementById('adminPass').value = '';
    document.getElementById('adminPass').focus();
  }
}

function doLogout() {
  isAdminLoggedIn = false;
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminContent').classList.add('hidden');
  showToast('تم تسجيل الخروج');
  switchTab('map', document.querySelector('[data-tab="map"]'));
}

/* ═══════════════════════════════════════
   تهيئة Google Maps
═══════════════════════════════════════ */
async function initMap() {
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 500);
  }, 1200);

  const defaultCenter = { lat: 24.7136, lng: 46.6753 };
  const { Map } = await google.maps.importLibrary('maps');
  await google.maps.importLibrary('marker');

  // حاول تحديد موقع المستخدم أولاً
  let center = defaultCenter;
  try {
    center = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(defaultCenter),
        { timeout: 5000 }
      );
    });
  } catch(e) { center = defaultCenter; }

  map = new Map(document.getElementById('map'), {
    center,
    zoom: 13,
    mapId: 'DEMO_MAP_ID',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });

  renderMapMarkers();
  updateStats();
}

/* ═══════════════════════════════════════
   الماركرز على الخريطة
═══════════════════════════════════════ */
async function renderMapMarkers() {
  if (!map) return;
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const { InfoWindow } = await google.maps.importLibrary('maps');

  Object.values(markers).forEach(m => m.map = null);
  markers = {};

  const infoWindow = new InfoWindow();
  const reports = DB.getAll().filter(r => r.status !== 'rejected');

  reports.forEach(report => {
    const pin = document.createElement('div');
    pin.innerHTML = buildPinHTML(report.status);
    pin.title = report.name;

    const marker = new AdvancedMarkerElement({
      map,
      position: { lat: report.lat, lng: report.lng },
      content: pin,
      title: report.name,
    });

    marker.addListener('click', () => {
      infoWindow.close();
      infoWindow.setContent(buildInfoWindowHTML(report));
      infoWindow.open(map, marker);
    });

    markers[report.id] = marker;
  });
}

function buildPinHTML(status) {
  const color  = status === 'approved' ? '#1D9E75' : '#EF9F27';
  const shadow = status === 'approved' ? 'rgba(29,158,117,.4)' : 'rgba(239,159,39,.4)';
  return `<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:0 3px 10px ${shadow};display:flex;align-items:center;justify-content:center;border:2px solid #fff;">
    <span style="transform:rotate(45deg);font-size:18px;line-height:1;">♿</span>
  </div>`;
}

function buildInfoWindowHTML(report) {
  const statusLabel = { approved: 'معتمد ✓', pending: 'قيد المراجعة ⏳' }[report.status] || '';
  const statusColor = report.status === 'approved' ? '#0F6E56' : '#854F0B';
  const date = new Date(report.createdAt).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
  return `
    <div dir="rtl" style="font-family:'Tajawal',sans-serif;min-width:200px;max-width:260px;padding:4px;">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;color:#202124;">${report.name}</div>
      ${report.address ? `<div style="font-size:12px;color:#5F6368;margin-bottom:6px;">📍 ${report.address}</div>` : ''}
      ${report.notes   ? `<div style="font-size:13px;color:#3C4043;margin-bottom:8px;line-height:1.5;">${report.notes}</div>` : ''}
      ${report.photo   ? `<img src="${report.photo}" style="width:100%;border-radius:6px;margin-bottom:8px;object-fit:cover;max-height:120px;" />` : ''}
      <div style="font-size:11px;color:${statusColor};font-weight:700;">${statusLabel}</div>
      <div style="font-size:11px;color:#9AA0A6;margin-top:2px;">${date}</div>
    </div>`;
}

async function addMarkerToMap(report) {
  if (!map) return;
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML(report.status);
  const marker = new AdvancedMarkerElement({ map, position: { lat: report.lat, lng: report.lng }, content: pin, title: report.name });
  markers[report.id] = marker;
  map.panTo({ lat: report.lat, lng: report.lng });
  map.setZoom(15);
}

async function updateMarker(report) {
  if (!map) return;
  if (markers[report.id]) markers[report.id].map = null;
  if (report.status === 'rejected') { delete markers[report.id]; return; }
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML(report.status);
  markers[report.id] = new AdvancedMarkerElement({ map, position: { lat: report.lat, lng: report.lng }, content: pin, title: report.name });
}

/* ═══════════════════════════════════════
   التبديل بين طرق الإدخال الثلاث
═══════════════════════════════════════ */
function switchMethod(method) {
  currentMethod = method;
  document.getElementById('methodGps').classList.toggle('active',  method === 'gps');
  document.getElementById('methodPick').classList.toggle('active', method === 'pick');
  document.getElementById('methodLink').classList.toggle('active', method === 'link');
  document.getElementById('sectionGps').classList.toggle('hidden',  method !== 'gps');
  document.getElementById('sectionPick').classList.toggle('hidden', method !== 'pick');
  document.getElementById('sectionLink').classList.toggle('hidden', method !== 'link');
  currentLat = null; currentLng = null; currentAddress = '';
  if (method === 'pick') renderPickMap();
}

/* ═══════════════════════════════════════
   الطريقة الثانية: اختر على الخريطة
═══════════════════════════════════════ */
async function renderPickMap() {
  if (pickMap) return;
  const container = document.getElementById('locPickMap');
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  let center = { lat: 24.7136, lng: 46.6753 };
  try {
    await new Promise((res) => {
      navigator.geolocation.getCurrentPosition(
        p => { center = { lat: p.coords.latitude, lng: p.coords.longitude }; res(); },
        () => res(), { timeout: 4000 }
      );
    });
  } catch(e) {}

  pickMap = new Map(container, {
    center, zoom: 14, mapId: 'DEMO_MAP_ID',
    disableDefaultUI: false, zoomControl: true,
    mapTypeControl: false, streetViewControl: false,
    fullscreenControl: false, gestureHandling: 'greedy',
  });

  pickMap.addListener('click', async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    currentLat = lat; currentLng = lng;

    if (pickMarker) pickMarker.map = null;
    const pin = document.createElement('div');
    pin.innerHTML = buildPinHTML('pending');
    pickMarker = new AdvancedMarkerElement({ map: pickMap, position: { lat, lng }, content: pin });

    const coordsEl = document.getElementById('pickCoords');
    coordsEl.classList.remove('hidden');
    coordsEl.textContent = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)} — جارٍ جلب العنوان...`;

    try {
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      const res = await new Geocoder().geocode({ location: { lat, lng } });
      if (res.results[0]) {
        currentAddress = res.results[0].formatted_address;
        coordsEl.textContent = `📍 ${currentAddress}`;
        if (!document.getElementById('locName').value) {
          const poi = res.results[0].address_components.find(c =>
            c.types.includes('point_of_interest') || c.types.includes('establishment')
          );
          if (poi) document.getElementById('locName').value = poi.long_name;
        }
      }
    } catch(e) {
      coordsEl.textContent = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  });
}

/* ═══════════════════════════════════════
   الطريقة الثالثة: استخراج من رابط
   (يدعم goo.gl عبر Cloudflare Worker)
═══════════════════════════════════════ */
async function extractFromLink() {
  const url     = document.getElementById('locLink').value.trim();
  const iconEl  = document.getElementById('linkBtnIcon');
  const titleEl = document.getElementById('linkBtnTitle');

  if (!url) { showToast('⚠️ يُرجى إدخال الرابط أولاً'); return; }

  const isGoogleMaps = url.includes('google.com/maps') ||
                       url.includes('maps.app.goo.gl') ||
                       url.includes('goo.gl/maps')     ||
                       url.includes('maps.google');
  if (!isGoogleMaps) { showToast('⚠️ يُرجى إدخال رابط من Google Maps فقط'); return; }

  iconEl.textContent  = '⏳';
  titleEl.textContent = 'جارٍ استخراج الموقع...';

  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  let lat = null, lng = null, placeName = '';

  // ── محاولة 1: إحداثيات مباشرة في الرابط ──
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
  }

  // ── محاولة 2: إرسال الرابط للـ Worker (يدعم goo.gl) ──
  if (!lat || !lng) {
    try {
      const res  = await fetch(`${WORKER_URL}/resolve?url=${encodeURIComponent(url)}`,
                               { signal: AbortSignal.timeout(10000) });
      const data = await res.json();

      if (data.success) {
        lat = data.lat;
        lng = data.lng;
        placeName = data.placeName || '';
      } else if (data.finalUrl) {
        for (const pat of patterns) {
          const m = data.finalUrl.match(pat);
          if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
        }
        placeName = data.placeName || '';
      }
    } catch(e) {
      console.warn('Worker error:', e);
    }
  }

  // ── محاولة 3: Places API باسم المكان ──
  if (!lat || !lng) {
    try {
      const placeMatch = url.match(/maps\/place\/([^/@?&]+)/);
      const query = placeMatch
        ? decodeURIComponent(placeMatch[1].replace(/\+/g,' '))
        : placeName;
      if (query) {
        const { Place } = await google.maps.importLibrary('places');
        const { places } = await Place.searchByText({ textQuery: query, fields: ['location','displayName','formattedAddress'] });
        if (places && places[0]) {
          lat = places[0].location.lat();
          lng = places[0].location.lng();
          currentAddress = places[0].formattedAddress || '';
          placeName = places[0].displayName || query;
        }
      }
    } catch(e) { console.warn('Places API:', e); }
  }

  // ── النتيجة ──
  if (lat && lng) {
    currentLat = lat; currentLng = lng;
    iconEl.textContent  = '✅';
    titleEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (placeName && !document.getElementById('locName').value)
      document.getElementById('locName').value = placeName;

    if (!currentAddress) {
      try {
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const res = await new Geocoder().geocode({ location: { lat, lng } });
        if (res.results[0]) currentAddress = res.results[0].formatted_address;
      } catch(e) {}
    }

    renderMiniMapLink(lat, lng);
    showToast('✅ تم تحديد الموقع بنجاح');
  } else {
    iconEl.textContent  = '❌';
    titleEl.textContent = 'تعذّر استخراج الموقع';
    showToast('⚠️ جرّب طريقة "اختر على الخريطة" بدلاً من ذلك');
  }
}

async function renderMiniMapLink(lat, lng) {
  const container = document.getElementById('locMiniMapLink');
  container.classList.remove('hidden');
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const m = new Map(container, { center: { lat, lng }, zoom: 16, mapId: 'DEMO_MAP_ID', disableDefaultUI: true, gestureHandling: 'none' });
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML('pending');
  new AdvancedMarkerElement({ map: m, position: { lat, lng }, content: pin });
}

/* ═══════════════════════════════════════
   نافذة الإرسال
═══════════════════════════════════════ */
function openModal() {
  resetModal();
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function resetModal() {
  currentLat = null; currentLng = null;
  currentAddress = ''; photoData = null;
  pickMap = null; pickMarker = null;

  document.getElementById('locName').value  = '';
  document.getElementById('locNotes').value = '';
  document.getElementById('locLink').value  = '';

  document.getElementById('locBtnTitle').textContent = 'تحديد موقعي الحالي';
  document.getElementById('locBtnSub').textContent   = 'اضغط للحصول على الإحداثيات';
  document.getElementById('locBtnIcon').textContent  = '📡';
  document.getElementById('locMiniMap').classList.add('hidden');

  document.getElementById('linkBtnIcon').textContent  = '🔍';
  document.getElementById('linkBtnTitle').textContent = 'استخراج الموقع من الرابط';
  document.getElementById('locMiniMapLink').classList.add('hidden');

  document.getElementById('locPickMap').innerHTML = '';
  document.getElementById('pickCoords').classList.add('hidden');

  switchMethod('gps');

  document.getElementById('photoPreviewArea').innerHTML =
    '<span style="font-size:28px">📷</span><span>اضغط لرفع صورة</span>';
  document.getElementById('photoInput').value = '';
  miniMap = null; miniMarker = null;
}

/* ═══════════════════════════════════════
   تحديد الموقع GPS
═══════════════════════════════════════ */
async function getLocation() {
  const titleEl = document.getElementById('locBtnTitle');
  const subEl   = document.getElementById('locBtnSub');
  const iconEl  = document.getElementById('locBtnIcon');

  iconEl.textContent  = '⏳';
  titleEl.textContent = 'جارٍ تحديد الموقع...';
  subEl.textContent   = 'يُرجى الانتظار';

  const onSuccess = async (pos) => {
    currentLat = pos.coords.latitude;
    currentLng = pos.coords.longitude;
    titleEl.textContent = `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
    subEl.textContent   = 'تم تحديد الموقع ✓';
    iconEl.textContent  = '✅';
    try {
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      const res = await new Geocoder().geocode({ location: { lat: currentLat, lng: currentLng } });
      if (res.results[0]) {
        currentAddress  = res.results[0].formatted_address;
        subEl.textContent = currentAddress;
        if (!document.getElementById('locName').value) {
          const comp = res.results[0].address_components.find(c =>
            c.types.includes('point_of_interest') || c.types.includes('establishment'));
          if (comp) document.getElementById('locName').value = comp.long_name;
        }
      }
    } catch(e) {}
    renderMiniMap();
  };

  const onError = () => {
    currentLat = 24.7136 + (Math.random() - 0.5) * 0.02;
    currentLng = 46.6753 + (Math.random() - 0.5) * 0.02;
    iconEl.textContent  = '⚠️';
    titleEl.textContent = `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
    subEl.textContent   = 'تعذّر GPS — تم استخدام موقع تقريبي';
    renderMiniMap();
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000 });
  } else { onError(); }
}

async function renderMiniMap() {
  const container = document.getElementById('locMiniMap');
  container.classList.remove('hidden');
  if (!miniMap) {
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
    miniMap = new Map(container, { center: { lat: currentLat, lng: currentLng }, zoom: 16, mapId: 'DEMO_MAP_ID', disableDefaultUI: true, gestureHandling: 'none' });
    const pin = document.createElement('div');
    pin.innerHTML = buildPinHTML('pending');
    miniMarker = new AdvancedMarkerElement({ map: miniMap, position: { lat: currentLat, lng: currentLng }, content: pin });
  } else {
    miniMap.setCenter({ lat: currentLat, lng: currentLng });
    if (miniMarker) miniMarker.position = { lat: currentLat, lng: currentLng };
  }
}

/* ═══════════════════════════════════════
   معاينة الصورة
═══════════════════════════════════════ */
function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    photoData = ev.target.result;
    document.getElementById('photoPreviewArea').innerHTML = `<img src="${photoData}" alt="صورة الموقف" />`;
  };
  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════
   إرسال الموقع
═══════════════════════════════════════ */
function submitReport() {
  if (!currentLat || !currentLng) { showToast('⚠️ يُرجى تحديد الموقع أولاً'); return; }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جارٍ الإرسال...';

  const report = DB.save({
    name:    document.getElementById('locName').value.trim() || 'موقف غير مسمى',
    notes:   document.getElementById('locNotes').value.trim(),
    lat:     currentLat, lng: currentLng,
    address: currentAddress, photo: photoData,
  });

  addMarkerToMap(report);

  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'إرسال الموقع';
    closeModal();
    updateStats();
    renderAdmin();
    switchTab('admin', document.querySelector('[data-tab="admin"]'));
    showToast('✅ تم استلام الموقع وسيُعرض بعد الاعتماد');
  }, 600);
}

/* ═══════════════════════════════════════
   لوحة الإدارة
═══════════════════════════════════════ */
function renderAdmin() {
  const filter = document.getElementById('filterSelect').value;
  let reports = DB.getAll();
  if (filter !== 'all') reports = reports.filter(r => r.status === filter);
  document.getElementById('adminCount').textContent = `${reports.length} بلاغ`;
  const list = document.getElementById('adminList');
  if (reports.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:#9AA0A6;"><div style="font-size:40px;margin-bottom:12px;">📭</div><div>لا توجد بلاغات</div></div>`;
    return;
  }
  list.innerHTML = reports.map(r => buildAdminCard(r)).join('');
}

function buildAdminCard(r) {
  const statusBadge = { approved:'معتمد', pending:'قيد المراجعة', rejected:'مرفوض' }[r.status];
  const date = new Date(r.createdAt).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
  const actions = r.status === 'pending' ? `
    <div class="card-actions">
      <button class="card-btn btn-approve" onclick="changeStatus('${r.id}','approved')">✓ اعتماد</button>
      <button class="card-btn btn-reject"  onclick="changeStatus('${r.id}','rejected')">✕ رفض</button>
      <button class="card-btn btn-map"     onclick="goToMap('${r.id}')">🗺 عرض</button>
    </div>` : `
    <div class="card-actions">
      <button class="card-btn btn-edit" onclick="openEdit('${r.id}')">✏️ تعديل</button>
      <button class="card-btn btn-map"  onclick="goToMap('${r.id}')">🗺 عرض على الخريطة</button>
    </div>`;
  return `
    <div class="report-card" id="card-${r.id}">
      <div class="card-row">
        <div>
          <div class="card-name">${r.name}</div>
          ${r.notes   ? `<div class="card-notes">${r.notes}</div>` : ''}
          ${r.address ? `<div class="card-notes" style="color:#9AA0A6;font-size:12px;">📍 ${r.address}</div>` : ''}
        </div>
        <span class="badge ${r.status}">${statusBadge}</span>
      </div>
      <div class="card-meta">
        <span>📅 ${date}</span>
        <span>🌐 ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</span>
      </div>
      ${r.photo ? `<img class="card-photo" src="${r.photo}" alt="صورة الموقف" />` : ''}
      ${actions}
    </div>`;
}

/* ═══════════════════════════════════════
   نافذة التعديل
═══════════════════════════════════════ */
let editingId   = null;
let editLat     = null;
let editLng     = null;
let editAddress = '';
let editPhoto   = null;
let editPickMap = null;
let editPickMarker = null;

function openEdit(id) {
  const report = DB.getById(id);
  if (!report) return;

  editingId   = id;
  editLat     = report.lat;
  editLng     = report.lng;
  editAddress = report.address || '';
  editPhoto   = report.photo  || null;

  // ملء الحقول
  document.getElementById('editName').value  = report.name  || '';
  document.getElementById('editNotes').value = report.notes || '';

  // عرض الموقع الحالي
  document.getElementById('editCurrentLoc').innerHTML =
    `📍 ${report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}`;

  // الصورة
  document.getElementById('editPhotoPreview').innerHTML = report.photo
    ? `<img src="${report.photo}" alt="صورة الموقف" />`
    : '<span style="font-size:28px">📷</span><span>اضغط لتغيير الصورة</span>';

  document.getElementById('editPickCoords').classList.add('hidden');
  document.getElementById('editPickMap').innerHTML = '';
  editPickMap = null; editPickMarker = null;

  document.getElementById('editOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // تهيئة خريطة التعديل
  setTimeout(() => initEditMap(report.lat, report.lng), 100);
}

async function initEditMap(lat, lng) {
  const container = document.getElementById('editPickMap');
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  editPickMap = new Map(container, {
    center: { lat, lng }, zoom: 16,
    mapId: 'DEMO_MAP_ID',
    disableDefaultUI: false, zoomControl: true,
    mapTypeControl: false, streetViewControl: false,
    fullscreenControl: false, gestureHandling: 'greedy',
  });

  // ماركر للموقع الحالي
  const pinCurrent = document.createElement('div');
  pinCurrent.innerHTML = buildPinHTML('approved');
  editPickMarker = new AdvancedMarkerElement({
    map: editPickMap, position: { lat, lng }, content: pinCurrent,
  });

  // عند الضغط لتغيير الموقع
  editPickMap.addListener('click', async (e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    editLat = newLat; editLng = newLng;

    editPickMarker.map = null;
    const pin = document.createElement('div');
    pin.innerHTML = buildPinHTML('pending');
    editPickMarker = new AdvancedMarkerElement({
      map: editPickMap, position: { lat: newLat, lng: newLng }, content: pin,
    });

    const coordsEl = document.getElementById('editPickCoords');
    coordsEl.classList.remove('hidden');
    coordsEl.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)} — جارٍ جلب العنوان...`;

    try {
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      const res = await new Geocoder().geocode({ location: { lat: newLat, lng: newLng } });
      if (res.results[0]) {
        editAddress = res.results[0].formatted_address;
        coordsEl.textContent = `📍 ${editAddress}`;
      }
    } catch(e) {
      coordsEl.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
    }
  });
}

function previewEditPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    editPhoto = ev.target.result;
    document.getElementById('editPhotoPreview').innerHTML =
      `<img src="${editPhoto}" alt="صورة الموقف" />`;
  };
  reader.readAsDataURL(file);
}

function saveEdit() {
  if (!editingId) return;

  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ...';

  const all = DB.getAll();
  const idx = all.findIndex(r => r.id === editingId);
  if (idx !== -1) {
    all[idx].name    = document.getElementById('editName').value.trim()  || all[idx].name;
    all[idx].notes   = document.getElementById('editNotes').value.trim();
    all[idx].lat     = editLat;
    all[idx].lng     = editLng;
    all[idx].address = editAddress;
    if (editPhoto) all[idx].photo = editPhoto;
    all[idx].updatedAt = new Date().toISOString();
    localStorage.setItem('disability_parking_reports', JSON.stringify(all));
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '💾 حفظ التعديلات';
    closeEdit();
    renderAdmin();
    renderMapMarkers();
    updateStats();
    showToast('✅ تم حفظ التعديلات بنجاح');
  }, 500);
}

function closeEdit() {
  document.getElementById('editOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  editingId = null; editPickMap = null; editPickMarker = null;
}

function closeEditOutside(e) {
  if (e.target === document.getElementById('editOverlay')) closeEdit();
}

function changeStatus(id, status) {
  const report = DB.updateStatus(id, status);
  if (report) {
    updateMarker(report);
    updateStats();
    renderAdmin();
    showToast(status === 'approved' ? 'تم اعتماد الموقف وإضافته للخريطة ✅' : 'تم رفض البلاغ');
  }
}

function goToMap(id) {
  const report = DB.getById(id);
  if (!report || !map) return;
  switchTab('map', document.querySelector('[data-tab="map"]'));
  map.panTo({ lat: report.lat, lng: report.lng });
  map.setZoom(16);
  setTimeout(() => { if (markers[id]) google.maps.event.trigger(markers[id], 'click'); }, 300);
}

/* ═══════════════════════════════════════
   التنقل بين التبويبات
═══════════════════════════════════════ */
function switchTab(name, clickedEl) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  if (clickedEl) clickedEl.classList.add('active');
  document.getElementById('tab-' + name).classList.remove('hidden');
  if (name === 'admin') renderAdmin();
  if (name === 'map') renderMapMarkers();
}

/* ═══════════════════════════════════════
   الإحصائيات
═══════════════════════════════════════ */
function updateStats() {
  const s = DB.stats();
  document.getElementById('statsLabel').textContent = `${s.approved} معتمد · ${s.pending} قيد المراجعة`;
}

/* ═══════════════════════════════════════
   مشاركة الموقع
═══════════════════════════════════════ */
async function shareApp() {
  const shareData = {
    title: 'مواقف ذوي الإعاقة',
    text: 'تطبيق للإبلاغ عن مواقف ذوي الإعاقة ومشاركتها — ساهم في بناء مجتمع أكثر شمولاً 🦽',
    url: window.location.href,
  };
  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch(e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('✅ تم نسخ رابط الموقع — شاركه مع من تريد!');
  } catch {
    const input = document.createElement('input');
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('✅ تم نسخ رابط الموقع — شاركه مع من تريد!');
  }
}

/* ═══════════════════════════════════════
   إشعار Toast
═══════════════════════════════════════ */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}
