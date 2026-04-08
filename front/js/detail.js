let API_BASE_URL = 'http://localhost:8088/api/v1';
const _apiReady = (async () => {
  for (const port of [8088, 8080]) {
    try {
      const r = await fetch(`http://localhost:${port}/api/v1/business-categories`, { signal: AbortSignal.timeout(2000) });
      if (r.status < 600) { API_BASE_URL = `http://localhost:${port}/api/v1`; return; }
    } catch {}
  }
})();
const ui = window.AppUi;

const id = localStorage.getItem('businessId');
if (!id) window.location.href = 'home.html';

function getToken() {
  const token = localStorage.getItem('token');
  return token && token !== 'null' && token !== 'undefined' ? token : null;
}

function getJsonAuthHeaders() {
  const token = getToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    : { 'Content-Type': 'application/json' };
}

async function parseApiError(response) {
  try {
    const data = await response.json();
    return data?.message || data?.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function renderStars(score) {
  const value = Number.isFinite(Number(score)) ? Number(score) : 0;
  const filled = Math.round(value);
  const starsContainer = document.getElementById('detail-stars');
  if (!starsContainer) return;

  starsContainer.innerHTML = Array.from({ length: 5 }, (_, index) => `
    <span class="detail-star${index < filled ? ' detail-star--filled' : ''}">★</span>
  `).join('');
  starsContainer.setAttribute('aria-label', `Calificación ${value.toFixed(1)} de 5`);
}

function renderProducts(products) {
  const container = document.getElementById('detail-products');
  if (!container) return;

  if (!products.length) {
    container.innerHTML = '<p class="detail-description-text" style="color: var(--color-text-light);">Este negocio aún no tiene productos publicados.</p>';
    return;
  }

  container.innerHTML = products.map((product) => `
    <article class="detail-record">
      <div>
        <strong>${product.name}</strong>
        <p>${product.description || 'Sin descripción.'}</p>
      </div>
      <span class="detail-pill">$${Number(product.price || 0).toFixed(2)}</span>
    </article>
  `).join('');
}

function renderRatingsSummary(business, ratings) {
  const container = document.getElementById('ratings-summary');
  if (!container) return;

  const average = Number.isFinite(Number(business.averageRating)) ? Number(business.averageRating) : 0;
  const count = Number.isFinite(Number(business.ratingsCount)) ? Number(business.ratingsCount) : ratings.length;

  container.innerHTML = `
    <div class="detail-record detail-record--summary">
      <div>
        <strong>${average ? average.toFixed(1) : 'Sin calificación'}</strong>
        <p>${count ? `${count} valoraciones verificadas` : 'Sé la primera persona en valorar este negocio.'}</p>
      </div>
      <span class="detail-pill">${count || 0}</span>
    </div>
  `;
}

function renderRatingsList(ratings) {
  const container = document.getElementById('ratings-list');
  if (!container) return;

  if (!ratings.length) {
    container.innerHTML = '<p class="detail-description-text" style="color: var(--color-text-light);">Aún no hay reseñas disponibles.</p>';
    return;
  }

  container.innerHTML = ratings.map((rating) => `
    <article class="detail-record detail-record--column">
      <div class="detail-record-header">
        <strong>${rating.userName || 'Visitante'}</strong>
        <span class="detail-pill">${rating.score}/5</span>
      </div>
      <p>${rating.comment || 'Sin comentario adicional.'}</p>
    </article>
  `).join('');
}

function fillDetail(business) {
  const imgEl = document.getElementById('detail-image');
  const nameEl = document.getElementById('detail-name');
  const addrEl = document.getElementById('detail-address');
  const descEl = document.getElementById('detail-description');
  const badge = document.getElementById('detail-badge');
  const waEl = document.getElementById('detail-whatsapp');
  const mapsEl = document.getElementById('detail-maps-btn');

  const hasCoordinates = Number.isFinite(business.latitude) && Number.isFinite(business.longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${business.latitude},${business.longitude}`
    : 'https://maps.google.com';

  if (imgEl) {
    const fallback = `https://picsum.photos/800/500?random=${Number(id) + 100}`;
    const firstPhoto = Array.isArray(business.photoUrls) && business.photoUrls.length ? business.photoUrls[0] : fallback;
    imgEl.src = firstPhoto;
  }

  if (nameEl) nameEl.textContent = business.name || 'Negocio';

  if (addrEl) {
    addrEl.textContent = hasCoordinates
      ? `${business.latitude.toFixed(4)}, ${business.longitude.toFixed(4)}`
      : (business.categoryName || 'Ubicación no disponible');
  }

  if (descEl) {
    descEl.textContent = business.description || 'Este negocio aún no tiene descripción.';
  }

  renderStars(business.averageRating);

  if (badge) {
    if (business.verified) {
      badge.removeAttribute('hidden');
    } else {
      badge.setAttribute('hidden', '');
    }
  }

  if (waEl) {
    if (business.whatsappNumber) {
      waEl.href = `https://wa.me/${business.whatsappNumber}`;
      waEl.classList.remove('is-disabled');
      waEl.removeAttribute('aria-disabled');
    } else {
      waEl.href = '#';
      waEl.setAttribute('aria-disabled', 'true');
      waEl.classList.add('is-disabled');
    }
  }

  if (mapsEl) mapsEl.href = mapsUrl;
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/products/business/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();
    renderProducts(Array.isArray(products) ? products : []);
  } catch (error) {
    renderProducts([]);
    console.warn('[SelloDoradoMX] No se pudieron cargar los productos del negocio', error);
  }
}

async function loadRatings(business) {
  try {
    const res = await fetch(`${API_BASE_URL}/ratings/business/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ratings = await res.json();
    renderRatingsSummary(business, Array.isArray(ratings) ? ratings : []);
    renderRatingsList(Array.isArray(ratings) ? ratings : []);
  } catch (error) {
    renderRatingsSummary(business, []);
    renderRatingsList([]);
    console.warn('[SelloDoradoMX] No se pudieron cargar las valoraciones del negocio', error);
  }
}

function mountRatingForm() {
  const form = document.getElementById('rating-form');
  const submitBtn = document.getElementById('rating-submit-btn');
  if (!form || !submitBtn) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!getToken()) {
      await ui.alert({ title: 'Inicia sesión', text: 'Necesitas iniciar sesión para dejar una valoración.' });
      window.location.href = 'auth.html';
      return;
    }

    const score = Number(document.getElementById('rating-score')?.value || 0);
    const comment = document.getElementById('rating-comment')?.value.trim() || '';
    if (!score) {
      await ui.alert({ title: 'Falta la calificación', text: 'Selecciona una calificación antes de enviar.' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const res = await fetch(`${API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ businessId: Number(id), score, comment })
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      form.reset();
      const businessRes = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(id)}`);
      const business = await businessRes.json();
      fillDetail(business);
      await loadRatings(business);
      await ui.toast({ title: 'Tu valoración fue enviada correctamente.' });
    } catch (error) {
      await ui.error({ title: 'No se pudo enviar tu valoración', text: error.message });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar valoración';
    }
  });
}

async function loadBusinessDetail() {
  try {
    const res = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const business = await res.json();
    fillDetail(business);
    
    // Inicializar chat widget con el businessId
    if (typeof initChatWidget === 'function') {
      initChatWidget(business.id);
    }
    
    await Promise.all([loadProducts(), loadRatings(business)]);
  } catch (error) {
    console.error('[SelloDoradoMX] No se pudo cargar el detalle del negocio', error);
    window.location.href = 'home.html';
  }
}

mountRatingForm();
_apiReady.then(() => loadBusinessDetail());
