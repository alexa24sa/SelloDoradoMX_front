const API_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_USER_LAT = 19.4326;
const DEFAULT_USER_LON = -99.1332;
const DEFAULT_CATEGORIES = [
  { id: null, slug: 'all', label: 'Top' },
  { id: 1, slug: 'gastronomy', label: 'Gastronomía' },
  { id: 2, slug: 'stays', label: 'Hospedaje' },
  { id: 3, slug: 'culture', label: 'Cultura' },
  { id: 4, slug: 'adventure', label: 'Aventura' },
  { id: 5, slug: 'experiences', label: 'Experiencias' },
  { id: 6, slug: 'crafts', label: 'Artesanías' }
];

let map;
let userMarker;
let businessMarkers = [];
let activeCategory = 'all';
let allBusinesses = [];
let allNearest = [];
let categoryCatalog = [...DEFAULT_CATEGORIES];

const mockBusinesses = [
  {
    id: 1,
    name: 'Casa Azul Mundialista',
    location: 'Roma Norte, CDMX',
    rating: 4.8,
    ratingsCount: 18,
    category: 'stays',
    imageUrl: 'https://picsum.photos/400/500?random=1',
    isFavorite: false,
    hasGoldenSeal: true,
    latitude: 19.4194,
    longitude: -99.1601
  },
  {
    id: 2,
    name: 'Antojitos Doña Lupita',
    location: 'Centro Histórico, CDMX',
    rating: 4.6,
    ratingsCount: 27,
    category: 'gastronomy',
    imageUrl: 'https://picsum.photos/400/500?random=2',
    isFavorite: false,
    hasGoldenSeal: true,
    latitude: 19.4328,
    longitude: -99.1332
  }
];

const mockNearestBusinesses = [
  {
    id: 3,
    name: 'Ruta Cultural Coyoacán',
    location: 'A 1.1 km de ti',
    rating: 4.7,
    ratingsCount: 12,
    category: 'culture',
    imageUrl: 'https://picsum.photos/400/500?random=3',
    isFavorite: false,
    hasGoldenSeal: true,
    latitude: 19.3494,
    longitude: -99.1617
  },
  {
    id: 4,
    name: 'Taller de Artesanías Xochimilco',
    location: 'A 4.3 km de ti',
    rating: 4.9,
    ratingsCount: 9,
    category: 'crafts',
    imageUrl: 'https://picsum.photos/400/500?random=4',
    isFavorite: false,
    hasGoldenSeal: false,
    latitude: 19.2577,
    longitude: -99.1046
  }
];

function getCategorySlug(categoryName) {
  const value = String(categoryName || '').toUpperCase();
  if (value.includes('GASTRO')) return 'gastronomy';
  if (value.includes('STAY')) return 'stays';
  if (value.includes('CULT')) return 'culture';
  if (value.includes('ADVENT')) return 'adventure';
  if (value.includes('EXPERIENCE')) return 'experiences';
  if (value.includes('CRAFT')) return 'crafts';
  return 'all';
}

function formatLocation(business) {
  const hasCoordinates = Number.isFinite(business.latitude) && Number.isFinite(business.longitude);
  if (hasCoordinates) {
    return `${business.latitude.toFixed(4)}, ${business.longitude.toFixed(4)}`;
  }

  return business.categoryName || 'Ubicación disponible';
}

function mapBusinessFromApi(business, index = 0) {
  const image = Array.isArray(business.photoUrls) && business.photoUrls.length
    ? business.photoUrls[0]
    : `https://picsum.photos/400/500?random=${(business.id || index + 1) + 20}`;

  const rating = Number.isFinite(Number(business.averageRating)) ? Number(business.averageRating) : 0;
  const ratingsCount = Number.isFinite(Number(business.ratingsCount)) ? Number(business.ratingsCount) : 0;

  return {
    id: business.id,
    name: business.name || 'Negocio sin nombre',
    location: formatLocation(business),
    rating,
    ratingsCount,
    category: getCategorySlug(business.categoryName),
    imageUrl: image,
    isFavorite: false,
    hasGoldenSeal: !!business.verified,
    latitude: business.latitude,
    longitude: business.longitude
  };
}

function renderCategoryButtons() {
  const container = document.getElementById('categories-scroll');
  if (!container) return;

  container.innerHTML = categoryCatalog.map((category) => `
    <button
      class="category-btn${category.slug === activeCategory ? ' category-btn--active' : ''}"
      data-category="${category.slug}"
      role="tab"
      aria-selected="${category.slug === activeCategory}"
    >${category.label}</button>
  `).join('');
}

async function fetchBusinessCategories() {
  try {
    const res = await fetch(`${API_BASE_URL}/business-categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    categoryCatalog = [
      DEFAULT_CATEGORIES[0],
      ...data.map((category) => ({
        id: category.id,
        slug: getCategorySlug(category.name),
        label: category.name === 'STAYS'
          ? 'Hospedaje'
          : category.name === 'EXPERIENCES'
            ? 'Experiencias'
            : category.name === 'CRAFTS'
              ? 'Artesanías'
              : category.name === 'GASTRONOMY'
                ? 'Gastronomía'
                : category.name === 'CULTURE'
                  ? 'Cultura'
                  : category.name === 'ADVENTURE'
                    ? 'Aventura'
                    : category.name
      }))
    ];
  } catch (error) {
    console.warn('[SelloDoradoMX] No se pudo cargar el catálogo de categorías:', error.message);
    categoryCatalog = [...DEFAULT_CATEGORIES];
  }

  renderCategoryButtons();
}

function initMap(lat, lng, businesses = []) {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  // Si el mapa ya existe, sólo recentrar
  if (map) {
    map.setView([lat, lng], 15);
  } else {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);

    // Capa OpenStreetMap — 100% gratuita, sin API Key
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);
  }

  // Limpiar marcadores anteriores
  businessMarkers.forEach(m => m.remove());
  businessMarkers = [];
  if (userMarker) { userMarker.remove(); userMarker = null; }

  // Ícono personalizado para el usuario (punto azul)
  const userIcon = L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;background:#104578;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(16,69,120,0.5)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  userMarker = L.marker([lat, lng], { icon: userIcon, title: 'Tu ubicación' }).addTo(map);

  // Ícono personalizado para negocios (insignia dorada)
  const bizIcon = L.divIcon({
    className: '',
    html: '<div style="width:28px;height:28px;background:#FDB913;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:14px">⭐</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  // Marcadores de negocios
  businesses.forEach(b => {
    if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return;

    const marker = L.marker([b.latitude, b.longitude], { icon: bizIcon, title: b.name })
      .addTo(map)
      .bindPopup(`<strong>${b.name}</strong><br><small>${b.location || ''}</small>`);

    businessMarkers.push(marker);
  });
}

/* ── Modal: Inicio de sesión requerido ── */
function showLoginModal() {
  const backdrop = document.getElementById('login-modal-backdrop');
  if (!backdrop) return;
  backdrop.removeAttribute('hidden');
  document.getElementById('modal-close-btn').focus();
}

function hideLoginModal() {
  const backdrop = document.getElementById('login-modal-backdrop');
  if (backdrop) backdrop.setAttribute('hidden', '');
}

// Cerrar con X, "Ahora no" o clic en el backdrop
document.addEventListener('DOMContentLoaded', function () {
  const closeBtn   = document.getElementById('modal-close-btn');
  const dismissBtn = document.getElementById('modal-dismiss-btn');
  const backdrop   = document.getElementById('login-modal-backdrop');

  if (closeBtn)   closeBtn.addEventListener('click', hideLoginModal);
  if (dismissBtn) dismissBtn.addEventListener('click', hideLoginModal);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) hideLoginModal();
    });
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !backdrop.hasAttribute('hidden')) hideLoginModal();
    });
  }
});

function createCardHTML(b) {
  const filled = Math.round(b.rating || 0);
  const stars = '\u2605'.repeat(filled) + '\u2606'.repeat(5 - filled);
  const ratingLabel = b.ratingsCount
    ? `${b.rating.toFixed(1)} · ${b.ratingsCount} valoraciones`
    : 'Nuevo';

  return `
    <div class="card" data-id="${b.id}" data-category="${b.category}" role="article">
      <div class="card-image-wrapper">
        <img
          src="${b.imageUrl}"
          alt="${b.name}"
          class="card-image"
          loading="lazy"
          onerror="this.src='https://picsum.photos/400/500?random=${b.id + 10}'"
        />
        <div class="card-overlay" aria-hidden="true"></div>
        <button
          class="card-favorite${b.isFavorite ? ' liked' : ''}"
          aria-label="Agregar a favoritos"
          aria-pressed="${b.isFavorite}"
          data-id="${b.id}"
        >
          <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
        ${b.hasGoldenSeal ? '<img src="./assets/insignia.png" alt="Sello Dorado" class="seal-badge" title="Verificado con Sello Dorado" />' : ''}
      </div>
      <div class="card-content">
        <h3 class="card-title">${b.name}</h3>
        <div class="card-location">
          <svg class="location-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span>${b.location}</span>
        </div>
        <div class="card-rating" aria-label="Calificaci\u00f3n ${b.rating || 0} de 5">
          <span class="rating-stars" aria-hidden="true">${stars}</span>
          <span class="rating-count">${ratingLabel}</span>
        </div>
      </div>
    </div>
  `;
}

function renderBusinessCards(businesses, container) {
  if (!container) return;
  if (!businesses.length) {
    container.innerHTML = '<p class="empty-state">No se encontraron negocios en esta categoría.</p>';
    container.removeAttribute('aria-busy');
    return;
  }
  container.innerHTML = businesses.map(createCardHTML).join('');
  container.removeAttribute('aria-busy');
}

function applyFilters() {
  const term = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const match = (b) => {
    const byCategory = activeCategory === 'all' || b.category === activeCategory;
    const bySearch = !term
      || b.name.toLowerCase().includes(term)
      || b.location.toLowerCase().includes(term)
      || b.category.toLowerCase().includes(term);
    return byCategory && bySearch;
  };
  renderBusinessCards(allBusinesses.filter(match), document.getElementById('businesses-grid'));
  renderBusinessCards(allNearest.filter(match), document.getElementById('nearest-grid'));
}

/**
 * Función que obtiene todos los negocios
 */
async function fetchBusinesses() {
  try {
    const res = await fetch(`${API_BASE_URL}/businesses`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allBusinesses = Array.isArray(data) ? data.map(mapBusinessFromApi) : [];
  } catch (err) {
    console.warn('[SelloDoradoMX] Backend inactivo – usando mock de negocios:', err.message);
    allBusinesses = mockBusinesses;
  }
  renderBusinessCards(allBusinesses, document.getElementById('businesses-grid'));
}

/**
 * Función que obtiene los negocios cercanos
 */
async function fetchNearestBusinesses(lat, lng) {
  const container = document.getElementById('nearest-grid');
  const safeLat = lat ?? DEFAULT_USER_LAT;
  const safeLng = lng ?? DEFAULT_USER_LON;
  const url = `${API_BASE_URL}/businesses/nearest?userLat=${encodeURIComponent(safeLat)}&userLon=${encodeURIComponent(safeLng)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allNearest = Array.isArray(data) ? data.map(mapBusinessFromApi) : [];
  } catch (err) {
    console.warn('[SelloDoradoMX] Backend inactivo – usando mock de negocios cercanos:', err.message);
    allNearest = mockNearestBusinesses;
  }
  renderBusinessCards(allNearest, container);
  initMap(safeLat, safeLng, allNearest);
}

function loadNearestWithGeo() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => fetchNearestBusinesses(coords.latitude, coords.longitude),
      ()           => fetchNearestBusinesses()
    );
  } else {
    fetchNearestBusinesses();
  }
}

// ─── INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchBusinessCategories();

  // 1. Cargar datos (fallback a mocks si el backend está apagado)
  fetchBusinesses();
  loadNearestWithGeo();

  // 2. Filtro de categorías (event delegation)
  const categoriesScroll = document.querySelector('.categories-scroll');
  if (categoriesScroll) {
    categoriesScroll.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      categoriesScroll.querySelectorAll('.category-btn').forEach((b) => {
        b.classList.remove('category-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('category-btn--active');
      btn.setAttribute('aria-selected', 'true');
      activeCategory = btn.dataset.category;
      applyFilters();
    });
  }

  // 3. Búsqueda en tiempo real
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', applyFilters);

  // 4. Toggle favorito — requiere sesión iniciada
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-favorite');
    if (!btn) return;

    const isLoggedIn = !!localStorage.getItem('token');
    if (!isLoggedIn) {
      showLoginModal();
      return;
    }

    btn.classList.toggle('liked');
    btn.setAttribute('aria-pressed', btn.classList.contains('liked'));
    // TODO: POST /favorites/{id} cuando se integre JWT
  });

  // 5. Navegar al detalle al hacer clic en una tarjeta
  document.body.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.target.closest('.card-favorite')) return;
    localStorage.setItem('businessId', card.dataset.id);
    window.location.href = 'detail.html';
  });

  // 6. Alerta de bienvenida: explica la insignia Sello Dorado (se muestra solo una vez)
  if (!localStorage.getItem('selloDorado_alerted') && typeof Swal !== 'undefined') {
    const lang = (navigator.language || 'es').toLowerCase();
    const isSpanish = lang.startsWith('es');

    Swal.fire({
      title: isSpanish ? 'Negocios Certificados' : 'Certified Businesses',
      text: isSpanish
        ? 'Los negocios con este logo cuentan con capacitación de OLA México, cumpliendo con todas las normas y regulaciones de calidad.'
        : 'Businesses with this logo are trained by OLA México, complying with all quality norms and regulations.',
      imageUrl: './assets/insignia.png',
      imageWidth: 80,
      imageAlt: 'Sello Dorado',
      confirmButtonText: isSpanish ? 'Entendido' : 'Got it',
      confirmButtonColor: '#6BB88A',
      background: '#ffffff',
      customClass: { popup: 'swal-sello-popup' }
    }).then(() => {
      localStorage.setItem('selloDorado_alerted', '1');
    });
  }

});
