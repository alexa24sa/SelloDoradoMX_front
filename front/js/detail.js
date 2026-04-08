let API_BASE_URL = 'http://localhost:8088/api/v1';

/* ── Carrusel genérico ────────────────────────────────────────────── */
function buildCarousel(trackId, dotsId, photos, fallback) {
  const track = document.getElementById(trackId);
  const dotsEl = document.getElementById(dotsId);
  if (!track) return;

  const images = (Array.isArray(photos) && photos.length) ? photos : [fallback];
  let current = 0;

  track.innerHTML = images.map(src => `
    <div class="${trackId.startsWith('hero') ? 'hero-carousel-slide' : 'historia-carousel-slide'}">
      <img src="${src}" alt="Foto del negocio"
           class="${trackId.startsWith('hero') ? 'hero-carousel-img' : 'historia-carousel-img'}"
           onerror="this.src='${fallback}'" />
    </div>
  `).join('');

  if (dotsEl && images.length > 1) {
    dotsEl.innerHTML = images.map((_, i) =>
      `<button class="cdot${i === 0 ? ' cdot--active' : ''}" aria-label="Foto ${i + 1}"></button>`
    ).join('');

    dotsEl.querySelectorAll('.cdot').forEach((btn, i) => {
      btn.addEventListener('click', () => goTo(i));
    });
  }

  function goTo(index) {
    current = (index + images.length) % images.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    if (dotsEl) {
      dotsEl.querySelectorAll('.cdot').forEach((d, i) =>
        d.classList.toggle('cdot--active', i === current)
      );
    }
  }

  // Soporte táctil para deslizar
  let startX = 0;
  const container = track.parentElement;
  container.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  container.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
  }, { passive: true });

  // Auto-avance solo para el hero
  if (trackId === 'hero-carousel-track' && images.length > 1) {
    setInterval(() => goTo(current + 1), 4500);
  }
}

/* ── Usuario actual (para detectar si es comerciante) ──────────── */
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
}

const _apiReady = (async () => {
  for (const port of [8088, 8080]) {
    try {
      const r = await fetch(`http://localhost:${port}/api/v1/business-categories`, { signal: AbortSignal.timeout(2000) });
      if (r.status < 600) {
        API_BASE_URL = `http://localhost:${port}/api/v1`;
        return;
      }
    } catch {}
  }
})();

const ui = window.AppUi;
const businessId = Number(localStorage.getItem('businessId') || 0);
const pageState = {
  business: null,
  progress: null,
  qrScanner: null,
  scannerRunning: false,
  submittingScan: false
};

if (!businessId) window.location.href = 'home.html';

function getToken() {
  const token = localStorage.getItem('token');
  return token && token !== 'null' && token !== 'undefined' ? token : null;
}

function getTokenType() {
  return localStorage.getItem('tokenType') || 'Bearer';
}

function getJsonAuthHeaders() {
  const token = getToken();
  return token
    ? {
        Authorization: `${getTokenType()} ${token}`,
        'Content-Type': 'application/json'
      }
    : { 'Content-Type': 'application/json' };
}

async function alertAndRedirectToLogin(title, text) {
  await ui.alert({ title, text });
  window.location.href = 'auth.html';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.description || 'Sin descripción.')}</p>
      </div>
      <span class="detail-pill">$${Number(product.price || 0).toFixed(2)}</span>
    </article>
  `).join('');
}

function renderRatingsSummary(business, ratings) {
  const container = document.getElementById('ratings-summary');
  if (!container) return;

  const average = Number.isFinite(Number(business.averageRating)) ? Number(business.averageRating) : 0;
  const count = Number.isFinite(Number(business.reviewsCount))
  ? Number(business.reviewsCount)
  : ratings.length;
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
        <strong>${escapeHtml(rating.userName || 'Visitante')}</strong>
        <span class="detail-pill">${rating.score}/5</span>
      </div>
      <p>${escapeHtml(rating.comment || 'Sin comentario adicional.')}</p>
    </article>
  `).join('');
}

function renderProgress(progress = null) {
  const levelLabel = document.getElementById('progress-level-label');
  const progressCopy = document.getElementById('progress-copy');
  const progressPill = document.getElementById('progress-pill');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const rewardOffersList = document.getElementById('reward-offers-list');
  const scanAccessMessage = document.getElementById('scan-access-message');

  const currentLevel = Number(progress?.currentLevel || 1);
  const percentage = Number(progress?.percentage || 0);
  const rewardOffers = Array.isArray(progress?.rewardOffers)
    ? progress.rewardOffers
    : Array.isArray(pageState.business?.rewardOffers)
      ? pageState.business.rewardOffers
      : [];

  if (levelLabel) levelLabel.textContent = `Nivel ${currentLevel}`;
  if (progressPill) progressPill.textContent = `${percentage}%`;
  if (progressBarFill) progressBarFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;

  if (progressCopy) {
    if (progress?.completed) {
      progressCopy.textContent = 'Ya alcanzaste el nivel máximo de este negocio.';
    } else if (getToken()) {
      progressCopy.textContent = 'Escanea el QR oficial del local para avanzar otro 50%.';
    } else {
      progressCopy.textContent = 'Inicia sesión y escanea el QR del local para registrar tus visitas.';
    }
  }

  if (scanAccessMessage) {
    scanAccessMessage.textContent = getToken()
      ? 'Apunta al QR físico del local o pega su contenido para registrar tu visita.'
      : 'Necesitas iniciar sesión para registrar visitas y desbloquear ofertas.';
  }

  if (!rewardOffersList) return;
  if (!rewardOffers.length) {
    rewardOffersList.innerHTML = '<p class="detail-description-text">Este negocio todavía no tiene promociones por nivel.</p>';
    return;
  }

  rewardOffersList.innerHTML = rewardOffers
    .sort((left, right) => Number(left.requiredLevel || 0) - Number(right.requiredLevel || 0))
    .map((offer) => {
      const requiredLevel = Number(offer.requiredLevel || 1);
      const unlocked = currentLevel >= requiredLevel;
      return `
        <article class="reward-progress-item${unlocked ? '' : ' reward-progress-item--locked'}">
          <div>
            <strong>Nivel ${requiredLevel}</strong>
            <p>${escapeHtml(offer.offerText)}</p>
          </div>
          <span class="detail-pill">${unlocked ? 'Desbloqueada' : 'Bloqueada'}</span>
        </article>
      `;
    }).join('');
}

function syncScanButtons() {
  const startBtn = document.getElementById('start-qr-scan-btn');
  const stopBtn = document.getElementById('stop-qr-scan-btn');
  const shouldDisable = pageState.submittingScan;

  if (startBtn) startBtn.disabled = shouldDisable;
  if (stopBtn) stopBtn.hidden = !pageState.scannerRunning;
}

function fillDetail(business) {
  pageState.business = business;

  const nameEl  = document.getElementById('detail-name');
  const addrEl  = document.getElementById('detail-address');
  const descEl  = document.getElementById('detail-description');
  const badge   = document.getElementById('detail-badge');
  const waEl    = document.getElementById('detail-whatsapp');
  const mapsEl  = document.getElementById('detail-maps-btn');
  const premEl  = document.getElementById('premium-section');
  const ctaEl   = document.getElementById('coppel-cta');

  const hasCoordinates = Number.isFinite(business.latitude) && Number.isFinite(business.longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${business.latitude},${business.longitude}`
    : 'https://maps.google.com';

  const fallback = `https://picsum.photos/800/500?random=${businessId + 100}`;

  // Inicializar carruseles
  buildCarousel('hero-carousel-track', 'hero-carousel-dots', business.photoUrls, fallback);
  buildCarousel('historia-carousel-track', 'historia-carousel-dots', business.photoUrls, fallback);

  if (nameEl) nameEl.textContent = business.name || 'Negocio';

  if (addrEl) {
    addrEl.textContent = hasCoordinates
      ? `${business.latitude.toFixed(4)}, ${business.longitude.toFixed(4)}`
      : (business.categoryName || 'Ubicación no disponible');
  }

  if (descEl) {
    descEl.textContent = business.description || 'Este negocio aún no tiene descripción.';
  }

  // Historia: texto folclórico
  const historiaTextEl = document.getElementById('historia-text');
  if (historiaTextEl) {
    if (business.description) {
      historiaTextEl.textContent = business.description;
    } else {
      historiaTextEl.parentElement.innerHTML = '<p class="historia-empty">Este negocio aún no ha compartido su historia.</p>';
    }
  }

  renderStars(business.averageRating);
  renderProgress(pageState.progress);

  // Badge Sello Dorado
  if (badge) {
    business.verified ? badge.removeAttribute('hidden') : badge.setAttribute('hidden', '');
  }

  // Sección premium (negocios verificados / con sello)
  if (premEl) {
    business.verified ? premEl.removeAttribute('hidden') : premEl.setAttribute('hidden', '');
  }

  // CTA Coppel Emprende (solo para comerciantes sin sello)
  if (ctaEl) {
    const user = getCurrentUser();
    const isMerchant = user?.roleName === 'ROLE_MERCHANT' || user?.roleName === 'MERCHANT';
    if (isMerchant && !business.verified) {
      ctaEl.removeAttribute('hidden');
    } else {
      ctaEl.setAttribute('hidden', '');
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
    const res = await fetch(`${API_BASE_URL}/products/business/${encodeURIComponent(businessId)}`);
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
    const res = await fetch(`${API_BASE_URL}/ratings/business/${encodeURIComponent(businessId)}`);
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

async function loadProgress() {
  if (!getToken()) {
    pageState.progress = null;
    renderProgress(null);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/business-progress/businesses/${encodeURIComponent(businessId)}/me`, {
      headers: { Authorization: `${getTokenType()} ${getToken()}` }
    });

    if (res.status === 401) {
      pageState.progress = null;
      renderProgress(null);
      return;
    }

    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }

    pageState.progress = await res.json();
    renderProgress(pageState.progress);
  } catch (error) {
    console.warn('[SelloDoradoMX] No se pudo cargar el progreso del usuario', error);
    pageState.progress = null;
    renderProgress(null);
  }
}

function parseQrContent(rawContent) {
  const value = String(rawContent || '').trim();
  const parts = value.split('|');

  if (parts.length === 3 && parts[0] === 'SELLADO_QR') {
    const parsedBusinessId = Number(parts[1]);
    const qrToken = parts[2]?.trim();
    if (!Number.isFinite(parsedBusinessId) || !qrToken) {
      throw new Error('El contenido del QR no es válido.');
    }

    return { businessId: parsedBusinessId, qrToken };
  }

  throw new Error('El formato del QR no es válido para esta app.');
}

async function stopQrScanner() {
  const reader = document.getElementById('qr-reader');
  if (!pageState.qrScanner || !pageState.scannerRunning) {
    if (reader) reader.setAttribute('hidden', '');
    return;
  }

  try {
    await pageState.qrScanner.stop();
    await pageState.qrScanner.clear();
  } catch (error) {
    console.warn('[SelloDoradoMX] No se pudo detener el lector QR', error);
  } finally {
    pageState.scannerRunning = false;
    if (reader) {
      reader.innerHTML = '';
      reader.setAttribute('hidden', '');
    }
    syncScanButtons();
  }
}

async function submitQrVisit(rawContent) {
  if (!getToken()) {
    await ui.alert({ title: 'Inicia sesión', text: 'Necesitas iniciar sesión para registrar visitas.' });
    window.location.href = 'auth.html';
    return;
  }

  const payload = parseQrContent(rawContent);
  pageState.submittingScan = true;
  syncScanButtons();

  try {
    const res = await fetch(`${API_BASE_URL}/business-progress/scan`, {
      method: 'POST',
      headers: getJsonAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }

    pageState.progress = await res.json();
    renderProgress(pageState.progress);
    await ui.toast({ title: 'Visita registrada. Tu progreso avanzó correctamente.' });

    if (payload.businessId !== businessId) {
      localStorage.setItem('businessId', String(payload.businessId));
      window.location.href = 'detail.html';
      return;
    }
  } finally {
    pageState.submittingScan = false;
    syncScanButtons();
  }
}

async function startQrScanner() {
  if (!getToken()) {
    await ui.alert({ title: 'Inicia sesión', text: 'Necesitas iniciar sesión para escanear el QR del local.' });
    window.location.href = 'auth.html';
    return;
  }

  if (!window.Html5Qrcode) {
    await ui.error({ title: 'Cámara no disponible', text: 'No fue posible cargar el lector QR en este dispositivo.' });
    return;
  }

  const reader = document.getElementById('qr-reader');
  if (!reader) return;

  if (!pageState.qrScanner) {
    pageState.qrScanner = new window.Html5Qrcode('qr-reader');
  }

  reader.removeAttribute('hidden');
  pageState.scannerRunning = true;
  syncScanButtons();

  try {
    await pageState.qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decodedText) => {
        await stopQrScanner();
        try {
          await submitQrVisit(decodedText);
        } catch (error) {
          await ui.error({ title: 'No se pudo registrar la visita', text: error.message });
        }
      },
      () => {}
    );
  } catch (error) {
    pageState.scannerRunning = false;
    syncScanButtons();
    reader.setAttribute('hidden', '');
    await ui.error({ title: 'No se pudo abrir la cámara', text: 'Revisa los permisos del navegador o usa la validación manual.' });
  }
}

function mountScanActions() {
  document.getElementById('start-qr-scan-btn')?.addEventListener('click', async () => {
    await startQrScanner();
  });

  document.getElementById('stop-qr-scan-btn')?.addEventListener('click', async () => {
    await stopQrScanner();
  });

  window.addEventListener('beforeunload', () => {
    stopQrScanner();
  });
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
        body: JSON.stringify({ businessId, score, comment })
      });

      if (res.status === 401) {
        await alertAndRedirectToLogin('Sesión expirada', 'Inicia sesión de nuevo para enviar tu valoración.');
        return;
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      form.reset();
      const businessRes = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(businessId)}`);
      const business = await businessRes.json();
      
      fillDetail(business);
      await loadRatings(business);
      await ui.toast({ title: 'Tu valoración fue enviada correctamente.' });
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('no autenticado')) {
        await alertAndRedirectToLogin('Sesión expirada', 'Inicia sesión de nuevo para enviar tu valoración.');
        return;
      }
      await ui.error({ title: 'No se pudo enviar tu valoración', text: error.message });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar valoración';
    }
  });
}

async function loadBusinessDetail() {
  try {
    const res = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(businessId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const business = await res.json();
    fillDetail(business);
    // Inicializar chat widget con el businessId
    if (typeof initChatWidget === 'function') {
      initChatWidget(business.id);
    }
    await Promise.all([loadProducts(), loadRatings(business), loadProgress()]);
  } catch (error) {
    console.error('[SelloDoradoMX] No se pudo cargar el detalle del negocio', error);
    window.location.href = 'home.html';
  }
}

mountRatingForm();
mountScanActions();
_apiReady.then(() => loadBusinessDetail());
