// favorites.js - Manejo de favoritos
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8088/api/v1';

// Función para obtener favoritos desde localStorage (guardados temporalmente)
function getFavoritesFromStorage() {
  const favorites = localStorage.getItem('favorites');
  return favorites ? JSON.parse(favorites) : [];
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

  // Remover de localStorage
  const favorites = getFavoritesFromStorage();
  const updatedFavorites = favorites.filter(id => id !== businessId);
  localStorage.setItem('favorites', JSON.stringify(updatedFavorites));

  // Si hay API, llamar al endpoint
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_URL}/favorites/${businessId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
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

  // Intentar obtener desde API
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/favorites`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const businesses = Array.isArray(data) ? data : [];

      if (businesses.length === 0) {
        favoritesSection.hidden = true;
        emptySection.hidden = false;
        return;
      }

      container.innerHTML = businesses.map(b => {
        // Mapear datos de la API al formato esperado
        const business = {
          id: b.id || b.businessId,
          name: b.name || b.businessName,
          location: b.address || b.location || 'Ubicación disponible',
          rating: b.averageRating || 0,
          ratingsCount: b.ratingsCount || 0,
          category: b.categorySlug || 'all',
          imageUrl: b.photoUrls?.[0] || `https://picsum.photos/400/500?random=${b.id}`,
          hasGoldenSeal: !!b.verified,
          latitude: b.latitude,
          longitude: b.longitude
        };
        return createCardHTML(business);
      }).join('');

      favoritesSection.hidden = false;
      emptySection.hidden = true;
      return;
    }
  } catch (err) {
    console.log('Error al obtener favoritos de API:', err.message);
  }

  // Fallback: usar localStorage solamente (sin detalles completos)
  container.innerHTML = '<p class="empty-state">Cargando favoritos...</p>';
  favoritesSection.hidden = false;
  emptySection.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  loadFavorites();

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
