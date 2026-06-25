/**
 * app.js — المنطق الرئيسي للتطبيق
 * Google Maps API + إدارة البلاغات
 */

/* ═══════════════════════════════════════
   الحالة العامة
═══════════════════════════════════════ */
let map = null;
let markers = {};          // { id: google.maps.marker.AdvancedMarkerElement }
let miniMap = null;        // خريطة صغيرة في نافذة الإبلاغ
let miniMarker = null;
let currentLat = null;
let currentLng = null;
let currentAddress = '';
let photoData = null;      // base64

/* ═══════════════════════════════════════
   تهيئة Google Maps
═══════════════════════════════════════ */
async function initMap() {
  // إخفاء شاشة البداية
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 500);
  }, 1200);

  // المركز الافتراضي: الرياض
  const defaultCenter = { lat: 24.7136, lng: 46.6753 };

  // استيراد المكتبات الحديثة
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  map = new Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 13,
    mapId: 'DEMO_MAP_ID',          // استبدل بـ Map ID خاص بك للـ Advanced Markers
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });

  // عرض جميع البلاغات على الخريطة
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

  // مسح الماركرز القديمة
  Object.values(markers).forEach(m => m.map = null);
  markers = {};

  const infoWindow = new InfoWindow();
  const reports = DB.getAll().filter(r => r.status !== 'rejected');

  reports.forEach(report => {
    // أيقونة مخصصة
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
  const color = status === 'approved' ? '#1D9E75' : '#EF9F27';
  const shadow = status === 'approved' ? 'rgba(29,158,117,.4)' : 'rgba(239,159,39,.4)';
  return `
    <div style="
      width:40px; height:40px; border-radius:50% 50% 50% 0;
      background:${color}; transform:rotate(-45deg);
      box-shadow: 0 3px 10px ${shadow};
      display:flex; align-items:center; justify-content:center;
      border:2px solid #fff;
    ">
      <span style="transform:rotate(45deg); font-size:18px; line-height:1;">♿</span>
    </div>`;
}

function buildInfoWindowHTML(report) {
  const statusLabel = { approved: 'معتمد ✓', pending: 'قيد المراجعة ⏳' }[report.status] || '';
  const statusColor = report.status === 'approved' ? '#0F6E56' : '#854F0B';
  const date = new Date(report.createdAt).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });

  return `
    <div dir="rtl" style="font-family:'Tajawal',sans-serif; min-width:200px; max-width:260px; padding:4px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:4px; color:#202124;">${report.name}</div>
      ${report.address ? `<div style="font-size:12px; color:#5F6368; margin-bottom:6px;">📍 ${report.address}</div>` : ''}
      ${report.notes ? `<div style="font-size:13px; color:#3C4043; margin-bottom:8px; line-height:1.5;">${report.notes}</div>` : ''}
      ${report.photo ? `<img src="${report.photo}" style="width:100%;border-radius:6px;margin-bottom:8px;object-fit:cover;max-height:120px;" />` : ''}
      <div style="font-size:11px; color:${statusColor}; font-weight:700;">${statusLabel}</div>
      <div style="font-size:11px; color:#9AA0A6; margin-top:2px;">${date}</div>
    </div>`;
}

/* ═══════════════════════════════════════
   إضافة ماركر مؤقت بعد إضافة تقرير
═══════════════════════════════════════ */
async function addMarkerToMap(report) {
  if (!map) return;
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML(report.status);

  const marker = new AdvancedMarkerElement({
    map,
    position: { lat: report.lat, lng: report.lng },
    content: pin,
    title: report.name,
  });
  markers[report.id] = marker;

  map.panTo({ lat: report.lat, lng: report.lng });
  map.setZoom(15);
}

/* ═══════════════════════════════════════
   تحديث ماركر بعد اعتماد / رفض
═══════════════════════════════════════ */
async function updateMarker(report) {
  if (!map) return;
  if (markers[report.id]) markers[report.id].map = null;

  if (report.status === 'rejected') {
    delete markers[report.id];
    return;
  }

  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML(report.status);

  markers[report.id] = new AdvancedMarkerElement({
    map,
    position: { lat: report.lat, lng: report.lng },
    content: pin,
    title: report.name,
  });
}

/* ═══════════════════════════════════════
   التبديل بين طريقتَي الإدخال
═══════════════════════════════════════ */
let currentMethod = 'gps'; // 'gps' | 'link'

function switchMethod(method) {
  currentMethod = method;

  // تحديث أزرار الاختيار
  document.getElementById('methodGps').classList.toggle('active', method === 'gps');
  document.getElementById('methodLink').classList.toggle('active', method === 'link');

  // إظهار/إخفاء الأقسام
  document.getElementById('sectionGps').classList.toggle('hidden', method !== 'gps');
  document.getElementById('sectionLink').classList.toggle('hidden', method !== 'link');

  // إعادة تعيين الموقع عند التبديل
  currentLat = null; currentLng = null; currentAddress = '';
}

/* ═══════════════════════════════════════
   استخراج الموقع من رابط Google Maps
═══════════════════════════════════════ */
async function extractFromLink() {
  const url = document.getElementById('locLink').value.trim();
  const iconEl  = document.getElementById('linkBtnIcon');
  const titleEl = document.getElementById('linkBtnTitle');

  if (!url) { showToast('⚠️ يُرجى إدخال الرابط أولاً'); return; }

  iconEl.textContent  = '⏳';
  titleEl.textContent = 'جارٍ استخراج الموقع...';

  // --- محاولة 1: إحداثيات مباشرة في الرابط الطويل ---
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  let lat = null, lng = null;
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
  }

  // --- محاولة 2: رابط مختصر goo.gl أو maps.app.goo.gl ---
  if (!lat || !lng) {
    const isShortLink = url.includes('goo.gl') || url.includes('maps.app');
    if (isShortLink) {
      try {
        // نستخدم خدمة وسيطة مجانية لفكّ الرابط المختصر
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();

        // نبحث في الـ HTML المُعاد عن الإحداثيات
        const html = data.contents || '';
        for (const pat of patterns) {
          const m = html.match(pat);
          if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
        }

        // أو نبحث عن الـ URL النهائي بعد إعادة التوجيه
        if (!lat || !lng) {
          const urlMatch = html.match(/https:\/\/www\.google\.com\/maps[^"'\s]*/);
          if (urlMatch) {
            const finalUrl = urlMatch[0].replace(/\\u003d/g,'=').replace(/\\u0026/g,'&');
            for (const pat of patterns) {
              const m = finalUrl.match(pat);
              if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
            }
          }
        }
      } catch(e) {
        // إذا فشل الـ proxy جرّب Places Text Search
        console.warn('Proxy failed, trying Places API:', e);
      }
    }
  }

  // --- محاولة 3: Place Text Search عبر Google Places ---
  if (!lat || !lng) {
    try {
      const placeMatch = url.match(/maps\/place\/([^/@?&]+)/);
      if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ').replace(/-/g,' '));
        const { Place } = await google.maps.importLibrary('places');
        const req = { textQuery: placeName, fields: ['location','displayName','formattedAddress'] };
        const { places } = await Place.searchByText(req);
        if (places && places[0]) {
          lat = places[0].location.lat();
          lng = places[0].location.lng();
          currentAddress = places[0].formattedAddress || '';
          if (!document.getElementById('locName').value) {
            document.getElementById('locName').value = places[0].displayName || placeName;
          }
        }
      }
    } catch(e) { console.warn('Places API failed:', e); }
  }

  // --- محاولة 4: Geocoding بالاسم ---
  if (!lat || !lng) {
    try {
      const placeMatch = url.match(/maps\/place\/([^/@?&]+)/);
      if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g,' ').replace(/-/g,' '));
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const res = await new Geocoder().geocode({ address: placeName });
        if (res.results[0]) {
          lat = res.results[0].geometry.location.lat();
          lng = res.results[0].geometry.location.lng();
          currentAddress = res.results[0].formatted_address;
          if (!document.getElementById('locName').value)
            document.getElementById('locName').value = placeName;
        }
      }
    } catch(e) {}
  }

  // ─── النتيجة النهائية ───
  if (lat && lng) {
    currentLat = lat; currentLng = lng;
    iconEl.textContent  = '✅';
    titleEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // عكس الترميز للعنوان النصي إن لم يُحدَّد بعد
    if (!currentAddress) {
      try {
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const res = await new Geocoder().geocode({ location: { lat, lng } });
        if (res.results[0]) currentAddress = res.results[0].formatted_address;
      } catch(e) {}
    }

    renderMiniMapLink(lat, lng);
    showToast('✅ تم تحديد الموقع من الرابط');
  } else {
    iconEl.textContent  = '❌';
    titleEl.textContent = 'تعذّر استخراج الموقع';
    showToast('⚠️ لم يُتمكن من قراءة الرابط — جرّب الطريقة أدناه 👇');
    // عرض تعليمات بديلة
    showLinkHelp();
  }
}

function showLinkHelp() {
  const section = document.getElementById('sectionLink');
  let help = section.querySelector('.link-help');
  if (help) return;
  help = document.createElement('div');
  help.className = 'link-help';
  help.innerHTML = `
    <div class="help-title">💡 كيف تحصل على رابط يعمل؟</div>
    <ol class="help-steps">
      <li>افتح Google Maps على جهازك</li>
      <li>اضغط على الموقع المطلوب</li>
      <li>اضغط <strong>مشاركة</strong> ثم <strong>نسخ الرابط</strong></li>
      <li>أو اضغط على <strong>...</strong> ثم <strong>Share</strong></li>
      <li>الصق الرابط هنا مجدداً</li>
    </ol>
    <div class="help-alt">أو استخدم <strong>موقعي الحالي</strong> إذا أنت في المكان الآن</div>
  `;
  section.appendChild(help);
}


async function renderMiniMapLink(lat, lng) {
  const container = document.getElementById('locMiniMapLink');
  container.classList.remove('hidden');

  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  const m = new Map(container, {
    center: { lat, lng }, zoom: 16,
    mapId: 'DEMO_MAP_ID',
    disableDefaultUI: true, gestureHandling: 'none',
  });
  const pin = document.createElement('div');
  pin.innerHTML = buildPinHTML('pending');
  new AdvancedMarkerElement({ map: m, position: { lat, lng }, content: pin });
}


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
  currentMethod = 'gps';

  document.getElementById('locName').value  = '';
  document.getElementById('locNotes').value = '';
  document.getElementById('locLink').value  = '';

  // إعادة تعيين GPS
  document.getElementById('locBtnTitle').textContent = 'تحديد موقعي الحالي';
  document.getElementById('locBtnSub').textContent   = 'اضغط للحصول على الإحداثيات';
  document.getElementById('locBtnIcon').textContent  = '📡';
  document.getElementById('locMiniMap').classList.add('hidden');

  // إعادة تعيين الرابط
  document.getElementById('linkBtnIcon').textContent  = '🔍';
  document.getElementById('linkBtnTitle').textContent = 'استخراج الموقع من الرابط';
  document.getElementById('locMiniMapLink').classList.add('hidden');

  // العودة للطريقة الأولى
  switchMethod('gps');

  document.getElementById('photoPreviewArea').innerHTML =
    '<span style="font-size:28px">📷</span><span>اضغط لرفع صورة</span>';
  document.getElementById('photoInput').value = '';
  miniMap = null; miniMarker = null;
}

/* ═══════════════════════════════════════
   تحديد الموقع (GPS + Geocoding)
═══════════════════════════════════════ */
async function getLocation() {
  const titleEl = document.getElementById('locBtnTitle');
  const subEl   = document.getElementById('locBtnSub');
  const iconEl  = document.getElementById('locBtnIcon');

  iconEl.textContent = '⏳';
  titleEl.textContent = 'جارٍ تحديد الموقع...';
  subEl.textContent = 'يُرجى الانتظار';

  const onSuccess = async (pos) => {
    currentLat = pos.coords.latitude;
    currentLng = pos.coords.longitude;

    titleEl.textContent = `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
    subEl.textContent = 'تم تحديد الموقع ✓';
    iconEl.textContent = '✅';

    // عكس الترميز الجغرافي
    try {
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      const geocoder = new Geocoder();
      const res = await geocoder.geocode({ location: { lat: currentLat, lng: currentLng } });
      if (res.results[0]) {
        currentAddress = res.results[0].formatted_address;
        subEl.textContent = currentAddress;
        // ملء اسم الموقع تلقائياً إذا كان فارغاً
        if (!document.getElementById('locName').value) {
          const comp = res.results[0].address_components.find(c => c.types.includes('point_of_interest') || c.types.includes('establishment'));
          if (comp) document.getElementById('locName').value = comp.long_name;
        }
      }
    } catch (e) { /* Geocoding اختياري */ }

    renderMiniMap();
  };

  const onError = () => {
    // موقع تجريبي عند رفض الإذن
    currentLat = 24.7136 + (Math.random() - 0.5) * 0.02;
    currentLng = 46.6753 + (Math.random() - 0.5) * 0.02;
    iconEl.textContent = '⚠️';
    titleEl.textContent = `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
    subEl.textContent = 'تعذّر الوصول إلى GPS — تم استخدام موقع تقريبي';
    renderMiniMap();
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000 });
  } else {
    onError();
  }
}

async function renderMiniMap() {
  const container = document.getElementById('locMiniMap');
  container.classList.remove('hidden');

  if (!miniMap) {
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    miniMap = new Map(container, {
      center: { lat: currentLat, lng: currentLng },
      zoom: 16,
      mapId: 'DEMO_MAP_ID',
      disableDefaultUI: true,
      gestureHandling: 'none',
    });

    const pin = document.createElement('div');
    pin.innerHTML = buildPinHTML('pending');
    miniMarker = new AdvancedMarkerElement({
      map: miniMap, position: { lat: currentLat, lng: currentLng }, content: pin,
    });
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
    document.getElementById('photoPreviewArea').innerHTML =
      `<img src="${photoData}" alt="صورة الموقف" />`;
  };
  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════
   إرسال البلاغ
═══════════════════════════════════════ */
function submitReport() {
  if (!currentLat || !currentLng) {
    showToast('⚠️ يُرجى تحديد الموقع أولاً');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جارٍ الإرسال...';

  const report = DB.save({
    name:    document.getElementById('locName').value.trim() || 'موقف غير مسمى',
    notes:   document.getElementById('locNotes').value.trim(),
    lat:     currentLat,
    lng:     currentLng,
    address: currentAddress,
    photo:   photoData,
  });

  // إضافة ماركر فوري على الخريطة
  addMarkerToMap(report);

  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'إرسال البلاغ';
    closeModal();
    updateStats();
    renderAdmin();
    switchTab('admin', document.querySelector('[data-tab="admin"]'));
    showToast('✅ تم استلام البلاغ وسيُعرض بعد الاعتماد');
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
    list.innerHTML = `<div style="text-align:center;padding:40px;color:#9AA0A6;">
      <div style="font-size:40px;margin-bottom:12px;">📭</div>
      <div>لا توجد بلاغات</div>
    </div>`;
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
      <button class="card-btn btn-map" onclick="goToMap('${r.id}')">🗺 عرض على الخريطة</button>
    </div>`;

  return `
    <div class="report-card" id="card-${r.id}">
      <div class="card-row">
        <div>
          <div class="card-name">${r.name}</div>
          ${r.notes ? `<div class="card-notes">${r.notes}</div>` : ''}
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

function changeStatus(id, status) {
  const report = DB.updateStatus(id, status);
  if (report) {
    updateMarker(report);
    updateStats();
    renderAdmin();
    const label = status === 'approved' ? 'تم اعتماد الموقف وإضافته للخريطة ✅' : 'تم رفض البلاغ';
    showToast(label);
  }
}

function goToMap(id) {
  const report = DB.getById(id);
  if (!report || !map) return;
  switchTab('map', document.querySelector('[data-tab="map"]'));
  map.panTo({ lat: report.lat, lng: report.lng });
  map.setZoom(16);
  // فتح نافذة المعلومات
  setTimeout(() => {
    if (markers[id]) google.maps.event.trigger(markers[id], 'click');
  }, 300);
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
   الإحصائيات في الهيدر
═══════════════════════════════════════ */
function updateStats() {
  const s = DB.stats();
  document.getElementById('statsLabel').textContent =
    `${s.approved} معتمد · ${s.pending} قيد المراجعة`;
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

  // Web Share API — يفتح قائمة المشاركة الأصلية في الجوال
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      // المستخدم أغلق القائمة
      if (e.name === 'AbortError') return;
    }
  }

  // fallback — نسخ الرابط للحافظة
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('✅ تم نسخ رابط الموقع — شاركه مع من تريد!');
  } catch {
    // fallback قديم
    const input = document.createElement('input');
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('✅ تم نسخ رابط الموقع — شاركه مع من تريد!');
  }
}


let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}
