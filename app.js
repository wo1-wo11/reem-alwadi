// ========== إعدادات ==========
const GITHUB_USER = 'wo1-wo11';
const GITHUB_REPO = 'reem-alwadi';
const GITHUB_BRANCH = 'main';
const CONTENT_PATH = 'content/properties';

// ========== الخريطة ==========
mapboxgl.accessToken = 'pk.eyJ1IjoiYWFzYWRlIiwiYSI6ImNtdTdkaGhueDAwNHQyd3M4eWRkYzJteHoifQ.M6NHvQPVjZXBqPwxUhG_Rg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [46.6753, 24.7136],
  zoom: 10.5
});
map.addControl(new mapboxgl.NavigationControl(), 'top-left');
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true
}), 'top-left');

let allProperties = [];
let markers = [];

// ========== جلب العقارات من GitHub ==========
async function fetchProperties() {
  try {
    const url = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + CONTENT_PATH;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    
    const files = await res.json();
    
    const mdFiles = files.filter(function(f) {
      return f.name.endsWith('.md') && f.name !== '.gitkeep';
    });
    
    if (mdFiles.length === 0) {
      showNoProperties();
      return;
    }
    
    const promises = mdFiles.map(async function(file) {
      const contentRes = await fetch(file.download_url);
      const rawText = await contentRes.text();
      return parseMarkdown(rawText, file.name);
    });
    
    allProperties = await Promise.all(promises);
    
    updateDistricts();
    renderProperties(allProperties);
    renderMarkers(allProperties);
    
  } catch (error) {
    console.error('خطأ في جلب العقارات:', error);
    document.getElementById('propertiesList').innerHTML = 
      '<p style="text-align:center;grid-column:1/-1;color:#888;padding:40px">' +
      '❌ حدث خطأ في تحميل العقارات<br><small>' + error.message + '</small></p>';
  }
}

// ========== تحويل ملف Markdown إلى كائن ==========
function parseMarkdown(text, filename) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  
  if (!match) {
    return null;
  }
  
  try {
    const data = jsyaml.load(match[1]);
    
    return {
      title: data.title || 'بدون عنوان',
      type: data.type || '',
      district: data.district || '',
      price: Number(data.price) || 0,
      area: Number(data.area) || 0,
      rooms: Number(data.rooms) || 0,
      desc: data.desc || '',
      lng: Number(data.lng) || 46.6753,
      lat: Number(data.lat) || 24.7136,
      image: convertImageUrl(data.image),
      id: filename
    };
  } catch (e) {
    console.error('خطأ في تحليل ملف:', filename, e);
    return null;
  }
}

// ========== تحويل مسار الصورة ==========
function convertImageUrl(imagePath) {
  if (!imagePath) {
    return 'https://via.placeholder.com/400x300/1a3a2e/d4af37?text=صورة+العقار';
  }
  
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  const cleanPath = imagePath.replace(/^\//, '');
  return 'https://raw.githubusercontent.com/' + GITHUB_USER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + cleanPath;
}

// ========== عرض العقارات في البطاقات ==========
function formatPrice(p) {
  return p.toLocaleString('ar-SA') + ' ريال';
}

function renderProperties(list) {
  const container = document.getElementById('propertiesList');
  container.innerHTML = '';
  
  const filtered = list.filter(function(p) { return p !== null; });
  
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:#888;padding:40px">لا توجد عقارات مطابقة</p>';
    return;
  }
  
  filtered.forEach(function(p) {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = function() { openModal(p); };
    
    const roomsHTML = p.rooms > 0 ? '<span>🛏 ' + p.rooms + ' غرف</span>' : '';
    
    card.innerHTML = 
      '<div class="card-img" style="background-image:url(\'' + p.image + '\')">' +
        '<span class="card-badge">' + p.type + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<h3>' + p.title + '</h3>' +
        '<div class="price">' + formatPrice(p.price) + '</div>' +
        '<div class="card-info">' +
          '<span>📍 ' + p.district + '</span>' +
          '<span>📐 ' + p.area + ' م²</span>' +
          roomsHTML +
        '</div>' +
        '<span class="card-btn">التفاصيل</span>' +
      '</div>';
    
    container.appendChild(card);
  });
}

// ========== عرض الأيقونات على الخريطة ==========
function renderMarkers(list) {
  markers.forEach(function(m) { m.remove(); });
  markers = [];
  
  list.filter(function(p) { return p !== null; }).forEach(function(p) {
    const el = document.createElement('div');
    el.style.cssText = 
      'width: 36px; height: 36px; background: #d4af37;' +
      'border: 3px solid white; border-radius: 50% 50% 50% 0;' +
      'transform: rotate(-45deg); cursor: pointer;' +
      'box-shadow: 0 3px 10px rgba(0,0,0,0.3);' +
      'display: flex; align-items: center; justify-content: center;';
    
    const inner = document.createElement('div');
    inner.style.cssText = 'transform: rotate(45deg); font-size: 16px;';
    inner.textContent = '🏠';
    el.appendChild(inner);
    
    el.addEventListener('click', function() { openModal(p); });
    
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([p.lng, p.lat])
      .addTo(map);
    markers.push(marker);
  });
}

// ========== تحديث فلتر الأحياء ==========
function updateDistricts() {
  const districts = [];
  allProperties.filter(function(p) { return p; }).forEach(function(p) {
    if (p.district && districts.indexOf(p.district) === -1) {
      districts.push(p.district);
    }
  });
  
  const select = document.getElementById('filterDistrict');
  select.innerHTML = '<option value="">كل الأحياء</option>';
  
  districts.forEach(function(d) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

// ========== الفلترة ==========
function applyFilters() {
  const type = document.getElementById('filterType').value;
  const district = document.getElementById('filterDistrict').value;
  const priceRange = document.getElementById('filterPrice').value;
  
  const filtered = allProperties.filter(function(p) {
    if (!p) return false;
    if (type && p.type !== type) return false;
    if (district && p.district !== district) return false;
    if (priceRange) {
      const parts = priceRange.split('-');
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (p.price < min || p.price > max) return false;
    }
    return true;
  });
  
  renderProperties(filtered);
  renderMarkers(filtered);
}

document.getElementById('filterType').addEventListener('change', applyFilters);
document.getElementById('filterDistrict').addEventListener('change', applyFilters);
document.getElementById('filterPrice').addEventListener('change', applyFilters);

// ========== النافذة المنبثقة ==========
function openModal(p) {
  document.getElementById('modalImg').src = p.image;
  document.getElementById('modalTitle').textContent = p.title;
  document.getElementById('modalPrice').textContent = formatPrice(p.price);
  document.getElementById('modalDesc').textContent = p.desc;
  document.getElementById('modalType').textContent = p.type;
  document.getElementById('modalArea').textContent = p.area + ' م²';
  document.getElementById('modalDistrict').textContent = p.district;
  document.getElementById('modalRooms').textContent = p.rooms > 0 ? p.rooms + ' غرف' : '—';
  
  const msg = encodeURIComponent('السلام عليكم، مهتم بـ: ' + p.title + ' - السعر: ' + formatPrice(p.price));
  document.getElementById('modalWhatsapp').href = 'https://wa.me/966552500035?text=' + msg;
  document.getElementById('modal').classList.add('active');
  map.flyTo({ center: [p.lng, p.lat], zoom: 14, speed: 1.2 });
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target.id === 'modal') closeModal();
});

// ========== عند عدم وجود عقارات ==========
function showNoProperties() {
  document.getElementById('propertiesList').innerHTML = 
    '<p style="text-align:center;grid-column:1/-1;color:#888;padding:40px">' +
    '📭 لا توجد عقارات بعد<br><small>أضف عقارات من <a href="/admin/">لوحة التحكم</a></small></p>';
}

// ========== التشغيل ==========
map.on('load', function() {
  fetchProperties();
});
