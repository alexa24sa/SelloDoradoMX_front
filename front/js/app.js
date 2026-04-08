let API_BASE_URL = 'http://localhost:8088/api/v1';
const _apiReady = (async () => {
  for (const port of [8088, 8080]) {
    try {
      const r = await fetch(`http://localhost:${port}/api/v1/business-categories`, { signal: AbortSignal.timeout(2000) });
      if (r.status < 600) { API_BASE_URL = `http://localhost:${port}/api/v1`; return; }
    } catch {}
  }
})();
const DEFAULT_USER_LAT = 19.4326;
const DEFAULT_USER_LON = -99.1332;
const DEFAULT_CATEGORIES = [
  { id: null, slug: 'all', label: 'Top' },
  { id: null, slug: 'todos', label: 'Todos', name: 'ALL' },
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
let routeControl = null; // Control de ruta
let activeCategory = 'all';
let allBusinesses = [];
let allNearest = [];
let searchBusinesses = []; // Para resultados de búsqueda desde /businesses/all
let categoryCatalog = [...DEFAULT_CATEGORIES];
let currentUserLat = DEFAULT_USER_LAT;
let currentUserLng = DEFAULT_USER_LON;

const mockBusinesses = [];
const mockNearestBusinesses = [];

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
      DEFAULT_CATEGORIES[1],
      ...data.map((category) => ({
        id: category.id,
        name: category.name, // Nombre original del backend para peticiones
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

// Icono personalizado para el usuario (azul)
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `<div style="
    background-color: #3B82F6;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Icono personalizado para negocios (dorado/naranja)
const businessIcon = L.divIcon({
  className: 'business-marker',
  html: `<div style="
    background-color: #F59E0B;
    width: 24px;
    height: 24px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  "><span style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: bold;">⭐</span></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

function initMap(lat, lng, businesses = []) {
  // Guardar coordenadas del usuario para rutas
  currentUserLat = lat;
  currentUserLng = lng;

  if (!map) {
    map = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  } else {
    map.setView([lat, lng], 15);
  }

  // Limpiar marcadores y ruta previa
  businessMarkers.forEach(m => map.removeLayer(m));
  businessMarkers = [];
  if (routeControl) {
    map.removeControl(routeControl);
    routeControl = null;
  }

  if (userMarker) map.removeLayer(userMarker);

  // Marcador del usuario (azul)
  userMarker = L.marker([lat, lng], { icon: userIcon })
    .addTo(map)
    .bindPopup("<b>Tu ubicación</b>")
    .openPopup();

  // Marcadores de negocios (dorado)
  businesses.forEach(b => {
    if (!b.latitude || !b.longitude) return;

    const popupContent = `
      <div style="min-width: 150px;">
        <b style="font-size: 14px;">${b.name}</b>
        <p style="margin: 8px 0; font-size: 12px; color: #666;">${b.location}</p>
        <button onclick="showRouteToBusiness(${b.latitude}, ${b.longitude}, '${b.name.replace(/'/g, "\\'")}')"
                style="
                  background: #F59E0B;
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 6px;
                  cursor: pointer;
                  width: 100%;
                  font-size: 12px;
                  font-weight: bold;
                ">
          📍 Cómo llegar
        </button>
      </div>
    `;

    const marker = L.marker([b.latitude, b.longitude], { icon: businessIcon })
      .addTo(map)
      .bindPopup(popupContent);

    businessMarkers.push(marker);
  });

  const visiblePoints = [L.latLng(lat, lng), ...businesses
    .filter((business) => Number.isFinite(business.latitude) && Number.isFinite(business.longitude))
    .map((business) => L.latLng(business.latitude, business.longitude))];
  if (visiblePoints.length > 1) {
    map.fitBounds(L.latLngBounds(visiblePoints), { padding: [36, 36] });
  }
}

function requestCurrentPosition() {
  if (!('geolocation' in navigator)) {
    return Promise.resolve({ latitude: DEFAULT_USER_LAT, longitude: DEFAULT_USER_LON, isFallback: true });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ latitude: coords.latitude, longitude: coords.longitude, isFallback: false });
      },
      () => {
        resolve({ latitude: DEFAULT_USER_LAT, longitude: DEFAULT_USER_LON, isFallback: true });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Muestra una ruta desde la ubicación del usuario hasta un negocio
 */
function showRouteToBusiness(destLat, destLng, businessName) {
  // Limpiar ruta previa
  if (routeControl) {
    map.removeControl(routeControl);
  }

  // Crear nueva ruta usando OSRM (gratuito, sin API key)
  routeControl = L.Routing.control({
    waypoints: [
      L.latLng(currentUserLat, currentUserLng),
      L.latLng(destLat, destLng)
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    showAlternatives: false,
    lineOptions: {
      styles: [{ color: '#0f4e84', opacity: 0.95, weight: 7 }, { color: '#F59E0B', opacity: 1, weight: 4 }]
    },
    createMarker: function() { return null; }, // No crear marcadores adicionales
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    }),
    language: 'es',
    show: false,
    fitSelectedRoutes: true
  }).addTo(map);

  routeControl.on('routesfound', (event) => {
    const route = event.routes?.[0];
    const bounds = route?.bounds;
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  });

  routeControl.on('routingerror', () => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'No fue posible trazar la ruta',
        text: 'Intenta de nuevo cuando tu ubicación esté disponible.',
        icon: 'warning'
      });
    }
  });

  // Mostrar notificación
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Ruta calculada',
      text: `Mostrando ruta hacia "${businessName}"`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  }
}

/* ── Modal: Inicio de sesión requerido ── */
function showLoginModal() {
  const backdrop = document.getElementById('login-modal-backdrop');
  if (!backdrop) return;
  backdrop.removeAttribute('hidden');
  document.getElementById('modal-close-btn').focus();
}
function logout() {
  // Borra token o sesión
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Redirige al login
  window.location.href = "auth.html";
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
    const bySearch = !term
      || b.name.toLowerCase().includes(term)
      || b.location.toLowerCase().includes(term)
      || b.category.toLowerCase().includes(term);
    return bySearch;
  };
  // Si hay búsqueda, usar searchBusinesses (desde /businesses/all), sino usar allBusinesses (desde /businesses)
  const dataSource = term ? searchBusinesses : allBusinesses;
  renderBusinessCards(dataSource.filter(match), document.getElementById('businesses-grid'));
  renderBusinessCards(allNearest.filter(match), document.getElementById('nearest-grid'));
}

/**
 * Función que obtiene negocios filtrados por categoría si se especifica
 * @param {string|null} categorySlug - Slug de categoría (ej: 'gastronomy') o null para todas
 */
async function fetchBusinesses(categorySlug = null) {
  const container = document.getElementById('businesses-grid');
  try {
    // Construir URL: si se especifica categoría, agregar parámetro ?category=slug
    let url = `${API_BASE_URL}/businesses`;
    if (categorySlug && categorySlug !== 'all') {
      url += `?category=${encodeURIComponent(categorySlug)}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allBusinesses = Array.isArray(data) ? data.map(mapBusinessFromApi) : [];
  } catch (err) {
    console.warn('[SelloDoradoMX] Backend inactivo – usando mock de negocios:', err.message);
    if (categorySlug !== null) {
      const catSlug = getCategorySlug(categorySlug);
      allBusinesses = mockBusinesses.filter(b => b.category === catSlug);
    } else {
      allBusinesses = [...mockBusinesses];
    }
  }
  renderBusinessCards(allBusinesses, container);
}

/**
 * Función que obtiene todos los negocios para búsqueda (desde /businesses/all)
 */
async function fetchBusinessesForSearch() {
  try {
    let url = `${API_BASE_URL}/businesses/all`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    searchBusinesses = Array.isArray(data) ? data.map(mapBusinessFromApi) : [];
  } catch (err) {
    console.error('[SelloDoradoMX] Error al obtener negocios para búsqueda:', err.message);
    searchBusinesses = [];
  }
}

/**
 * Función que obtiene los negocios cercanos, opcionalmente filtrados por categoría
 * @param {number} lat - Latitud del usuario
 * @param {number} lng - Longitud del usuario
 * @param {number|null} categoryId - ID de categoría para filtrar (null = todas)
 */
async function fetchNearestBusinesses(lat, lng, categoryId = null) {
  const container = document.getElementById('nearest-grid');
  const safeLat = lat ?? DEFAULT_USER_LAT;
  const safeLng = lng ?? DEFAULT_USER_LON;

  // Construir URL con filtro de categoría si se proporciona
  let url = `${API_BASE_URL}/businesses/nearest?userLat=${encodeURIComponent(safeLat)}&userLon=${encodeURIComponent(safeLng)}`;
  if (categoryId !== null && categoryId !== undefined) {
    url += `&businessCat=${encodeURIComponent(categoryId)}`;
  }

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
    if (categoryId !== null) {
      const catSlug = DEFAULT_CATEGORIES.find(c => c.id === categoryId)?.slug;
      allNearest = mockNearestBusinesses.filter(b => b.category === catSlug);
    } else {
      allNearest = [...mockNearestBusinesses];
    }
  }
  renderBusinessCards(allNearest, container);
  initMap(safeLat, safeLng, allNearest);
}

async function loadNearestWithGeo(categoryId = null) {
  const position = await requestCurrentPosition();
  await fetchNearestBusinesses(position.latitude, position.longitude, categoryId);
}

// ─── INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await _apiReady;
  fetchBusinessCategories();

  // 1. Cargar datos (fallback a mocks si el backend está apagado)
  fetchBusinesses();
  loadNearestWithGeo();

  // 2. Filtro de categorías - fetch desde servidor con categoría como parámetro
  const categoriesScroll = document.querySelector('.categories-scroll');
  if (categoriesScroll) {
    categoriesScroll.addEventListener('click', async (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      categoriesScroll.querySelectorAll('.category-btn').forEach((b) => {
        b.classList.remove('category-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('category-btn--active');
      btn.setAttribute('aria-selected', 'true');
      activeCategory = btn.dataset.category;

      // Fetch negocios con filtro de categoría desde servidor
      await fetchBusinesses(activeCategory);

      // Actualizar mapa con todos los negocios cercanos (sin filtro de categoría)
      const selectedCategory = categoryCatalog.find((category) => category.slug === activeCategory);
      await loadNearestWithGeo(selectedCategory?.id ?? null);
    });
  }

  // 3. Búsqueda en tiempo real
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      const term = e.target.value.toLowerCase().trim();
      // Si hay texto de búsqueda y aún no hemos cargado searchBusinesses, cargar desde /businesses/all
      if (term && searchBusinesses.length === 0) {
        await fetchBusinessesForSearch();
      }
      applyFilters();
    });
  }

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
