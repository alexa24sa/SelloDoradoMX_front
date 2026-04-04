// URL base del API local (Spring Boot)
const API_BASE_URL = 'http://localhost:8080/api/v1';

// Mocks de negocios para cuando el backend esté apagado o falle la petición
const mockBusinesses = [
  {
    id: 1,
    name: 'Fonda "Doña María"',
    location: 'Antique / Burrito',
    rating: 4.8,
    category: 'gastronomy',
    imageUrl: 'https://picsum.photos/400/500?random=1',
    isFavorite: false
  },
  {
    id: 2,
    name: 'Antojitos "La pimienta"',
    location: 'Sakura / Pimienta',
    rating: 4.5,
    category: 'gastronomy',
    imageUrl: 'https://picsum.photos/400/500?random=2',
    isFavorite: true
  },
  {
    id: 3,
    name: 'Artesanías "El panalote"',
    location: 'Santa Clara / Gante',
    rating: 4.9,
    category: 'culture',
    imageUrl: 'https://picsum.photos/400/500?random=3',
    isFavorite: false
  },
  {
    id: 4,
    name: 'Juguetes "Salto de Piedra"',
    location: 'Salvatierra / Alonso',
    rating: 4.6,
    category: 'culture',
    imageUrl: 'https://picsum.photos/400/500?random=4',
    isFavorite: false
  }
];

const mockNearestBusinesses = [
  {
    id: 5,
    name: 'Tacos "El Gordo"',
    location: 'A 200m de ti',
    rating: 4.7,
    category: 'gastronomy',
    imageUrl: 'https://picsum.photos/400/500?random=5',
    isFavorite: false
  },
  {
    id: 6,
    name: 'Centro Cultural',
    location: 'A 500m de ti',
    rating: 4.9,
    category: 'culture',
    imageUrl: 'https://picsum.photos/400/500?random=6',
    isFavorite: true
  }
];

/**
 * Función genérica para renderizar tarjetas de negocios
 * @param {Array} businesses - Array de objetos de negocios
 * @param {HTMLElement} container - Contenedor del DOM donde inyectar las tarjetas
 */
function renderBusinessCards(businesses, container) {
  if (!container) return;
  
  container.innerHTML = ''; // Limpiar contenedor actual
  
  businesses.forEach(business => {
    const cardHTML = `
      <div class="card" data-id="${business.id}" data-category="${business.category}">
        <div class="card-image-wrapper">
          <img src="${business.imageUrl}" alt="${business.name}" class="card-image">
          <div class="card-overlay"></div>
          <button class="card-favorite ${business.isFavorite ? 'liked' : ''}" aria-label="Agregar a favoritos">
            <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
        <div class="card-content">
          <h3 class="card-title">${business.name}</h3>
          <div class="card-location">
            <svg class="location-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"/>
            </svg>
            <span>${business.location}</span>
          </div>
          <div class="card-rating">
            <span class="rating-stars">★★★★★</span>
            <span class="rating-count">(${business.rating})</span>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

/**
 * Función que obtiene todos los negocios
 */
async function fetchBusinesses() {
  const container = document.getElementById('businesses-grid');
  try {
    const response = await fetch(\`\${API_BASE_URL}/businesses\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': 'Bearer ' + localStorage.getItem('token') // Añadir cuando se integre el JWT
      }
    });

    if (!response.ok) throw new Error('Error al obtener negocios');
    
    const data = await response.json();
    renderBusinessCards(data, container);
  } catch (error) {
    console.warn('Backend inactivo o fallo en la petición. Cargando mock de negocios (SelloDorado)...', error);
    renderBusinessCards(mockBusinesses, container);
  }
}

/**
 * Función que obtiene los negocios cercanos
 */
async function fetchNearestBusinesses() {
  const container = document.getElementById('culture-grid'); // Usamos el segundo grid por ahora como ejemplo de cercanos
  try {
    const response = await fetch(\`\${API_BASE_URL}/businesses/nearest\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error al obtener negocios cercanos');
    
    const data = await response.json();
    renderBusinessCards(data, container);
  } catch (error) {
    console.warn('Backend inactivo o fallo en la petición. Cargando mock de negocios cercanos...', error);
    renderBusinessCards(mockNearestBusinesses, container);
  }
}

// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  fetchBusinesses();
  fetchNearestBusinesses();
  
  // Agregar eventos de favoritos una vez renderizados (simple event delegation)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.card-favorite')) {
      const btn = e.target.closest('.card-favorite');
      btn.classList.toggle('liked');
    }
  });
});
