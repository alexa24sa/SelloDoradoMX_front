let API_BASE_URL = 'http://localhost:8088/api/v1';
const FAVORITES_STORAGE_KEY = 'favoriteBusinessIds';
const _apiReady = (async () => {
  for (const port of [8088, 8080]) {
    try {
      const response = await fetch(`http://localhost:${port}/api/v1/business-categories`, { signal: AbortSignal.timeout(2000) });
      if (response.status < 600) {
        API_BASE_URL = `http://localhost:${port}/api/v1`;
        return;
      }
    } catch {}
  }
})();

function getToken() {
  const token = localStorage.getItem('token');
  return token && token !== 'null' && token !== 'undefined' ? token : null;
}

function getTokenType() {
  return localStorage.getItem('tokenType') || 'Bearer';
}

function getFavoritesFromStorage() {
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || localStorage.getItem('favorites') || '[]');
    return Array.isArray(favorites)
      ? favorites.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
  } catch {
    return [];
  }
}

function persistFavorites(ids) {
  const normalized = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))));
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem('favorites', JSON.stringify(normalized));
}

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
  const hasCoordinates = Number.isFinite(Number(business.latitude)) && Number.isFinite(Number(business.longitude));
  if (hasCoordinates) {
    return `${Number(business.latitude).toFixed(4)}, ${Number(business.longitude).toFixed(4)}`;
  }

  return business.categoryName || business.location || 'Ubicación disponible';
}

function mapBusinessFromApi(business) {
  return {
    id: business.id,
    name: business.name || 'Negocio sin nombre',
    location: formatLocation(business),
    rating: Number.isFinite(Number(business.averageRating)) ? Number(business.averageRating) : 0,
    ratingsCount: Number.isFinite(Number(business.ratingsCount)) ? Number(business.ratingsCount) : 0,
    category: getCategorySlug(business.categoryName),
    imageUrl: Array.isArray(business.photoUrls) && business.photoUrls.length
      ? business.photoUrls[0]
      : `https://picsum.photos/400/500?random=${business.id}`,
    hasGoldenSeal: !!business.verified,
    latitude: business.latitude,
    longitude: business.longitude
  };
}

// Función para crear tarjeta HTML (misma que en app.js)
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
          class="card-favorite liked"
          aria-label="Remover de favoritos"
          aria-pressed="true"
          data-id="${b.id}"
          onclick="removeFavorite(event, '${b.id}')"
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
        <div class="card-rating" aria-label="Calificación ${b.rating || 0} de 5">
          <span class="rating-stars" aria-hidden="true">${stars}</span>
          <span class="rating-count">${ratingLabel}</span>
        </div>
      </div>
    </div>
  `;
}

// Función para remover favorito
window.removeFavorite = async function(event, businessId) {
  event.stopPropagation();

  const isLoggedIn = !!localStorage.getItem('token');
  if (!isLoggedIn) {
    alert('Debes iniciar sesión para modificar favoritos');
    return;
  }

  const favorites = getFavoritesFromStorage();
  const updatedFavorites = favorites.filter(id => id !== Number(businessId));
  persistFavorites(updatedFavorites);

  try {
    await fetch(`${API_BASE_URL}/favorites/${businessId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `${getTokenType()} ${getToken()}`
      }
    });
  } catch (err) {
    console.log('Favorito removido localmente:', err.message);
  }

  // Recargar la lista
  loadFavorites();
};

// Cargar favoritos
async function loadFavorites() {
  const container = document.getElementById('favorites-grid');
  const emptySection = document.getElementById('empty-favorites');
  const favoritesSection = document.getElementById('favorites-section');

  const favoritesIds = getFavoritesFromStorage();

  if (!favoritesIds || favoritesIds.length === 0) {
    container.innerHTML = '';
    favoritesSection.hidden = true;
    emptySection.hidden = false;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/favorites`, {
      headers: {
        'Authorization': `${getTokenType()} ${getToken()}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const businesses = Array.isArray(data) ? data : [];
      persistFavorites(businesses.map((business) => Number(business.id)).filter((id) => Number.isFinite(id)));

      if (businesses.length === 0) {
        favoritesSection.hidden = true;
        emptySection.hidden = false;
        return;
      }

      container.innerHTML = businesses.map((business) => createCardHTML(mapBusinessFromApi(business))).join('');

      favoritesSection.hidden = false;
      emptySection.hidden = true;
      return;
    }
  } catch (err) {
    console.log('Error al obtener favoritos de API:', err.message);
  }

  try {
    const businesses = await Promise.all(favoritesIds.map(async (businessId) => {
      const res = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(businessId)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    }));

    container.innerHTML = businesses.map((business) => createCardHTML(mapBusinessFromApi(business))).join('');
    favoritesSection.hidden = false;
    emptySection.hidden = false;
    emptySection.hidden = true;
  } catch (err) {
    console.log('No se pudieron reconstruir favoritos desde negocios:', err.message);
    container.innerHTML = '<p class="empty-state">No fue posible cargar tus favoritos en este momento.</p>';
    favoritesSection.hidden = false;
    emptySection.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _apiReady.then(() => loadFavorites());

  // Botón explorar
  const exploreBtn = document.getElementById('explore-btn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      window.location.href = 'home.html';
    });
  }

  // Navegar al detalle al hacer clic en una tarjeta
  document.body.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.target.closest('.card-favorite')) return;
    localStorage.setItem('businessId', card.dataset.id);
    window.location.href = 'detail.html';
  });
});
