let API_BASE_URL = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || 'http://localhost:8088/api/v1';
const _apiReady = Promise.resolve(window.AppRuntimeConfig?.ready)
  .catch(() => null)
  .then(() => {
    API_BASE_URL = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || API_BASE_URL;
  });

const ui = window.AppUi;
const DEFAULT_LOCATION = { lat: 19.4326, lng: -99.1332 };
const LOCATION_PICKER_ZOOM = 17;
const state = {
  currentUser: null,
  categories: [],
  businesses: [],
  editingBusinessId: null,
  businessQrById: {},
  selectedLocation: null,
  selectedBusinessPhotoFiles: [],
  locationPickerMap: null,
  locationPickerInitialized: false,
  locationPickerCurrentMarker: null,
  activeProductFormBusinessId: null
};

function createCurrentLocationIcon() {
  return L.divIcon({
    className: 'location-picker-user-marker',
    html: '<span class="location-picker-user-dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function getToken() {
  const token = localStorage.getItem('token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

function getTokenType() {
  return localStorage.getItem('tokenType') || 'Bearer';
}

function getAuthHeaders() {
  return {
    Authorization: `${getTokenType()} ${getToken()}`
  };
}

function clearSessionAndGoAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('tokenType');
  localStorage.removeItem('currentUser');
  window.location.href = 'auth.html';
}

function roleToLabel(roleName) {
  if (roleName === 'ROLE_MERCHANT') return 'Cuenta de negocio';
  if (roleName === 'ROLE_ADMIN') return 'Administrador';
  return 'Cuenta personal';
}

function humanizeCategory(name) {
  const value = String(name || '').toUpperCase();
  if (value === 'GASTRONOMY') return 'Gastronomía';
  if (value === 'STAYS') return 'Hospedaje';
  if (value === 'CULTURE') return 'Cultura';
  if (value === 'ADVENTURE') return 'Aventura';
  if (value === 'EXPERIENCES') return 'Experiencias';
  if (value === 'CRAFTS') return 'Artesanías';
  return name || 'Sin categoría';
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSessionError(error) {
  return error?.message === 'SESSION_INVALID';
}

async function handleSessionError() {
  await ui.error({ title: 'Tu sesión expiró', text: 'Inicia sesión de nuevo para continuar.' });
  clearSessionAndGoAuth();
}

async function parseApiError(response) {
  try {
    const data = await response.json();
    return data?.message || data?.error || `HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

async function apiRequest(path, { method = 'GET', body, headers = {}, useJson = true } = {}) {
  const requestHeaders = { ...headers };
  if (getToken()) {
    Object.assign(requestHeaders, getAuthHeaders());
  }

  const options = { method, headers: requestHeaders };

  if (body !== undefined) {
    if (useJson) {
      options.headers = { ...requestHeaders, 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    } else {
      options.body = body;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (response.status === 401) {
    throw new Error('SESSION_INVALID');
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  if (response.status === 204) return null;
  return response.json();
}

function setUserUi(user) {
  const fullName = `${user?.name || ''} ${user?.lastname || ''}`.trim() || 'Merchant';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'M';

  document.getElementById('business-page-name').textContent = fullName;
  document.getElementById('business-page-role').textContent = roleToLabel(user?.roleName);
  document.getElementById('business-page-avatar').textContent = initials;
}

function setButtonLoading(buttonId, loading, idleLabel, loadingLabel) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingLabel : idleLabel;
}

function normalizeRewardOffers(rewardOffers) {
  return Array.isArray(rewardOffers)
    ? rewardOffers
        .filter((offer) => offer && (offer.offerText || offer.requiredLevel))
        .map((offer) => ({
          offerText: String(offer.offerText || '').trim(),
          requiredLevel: Number(offer.requiredLevel || 1)
        }))
        .sort((left, right) => left.requiredLevel - right.requiredLevel)
    : [];
}

function createRewardOfferFieldMarkup(offer = {}) {
  const offerText = escapeHtml(offer.offerText || '');
  const requiredLevel = Number(offer.requiredLevel || 1);

  return `
    <article class="reward-offer-row">
      <textarea class="auth-input detail-textarea reward-offer-text" placeholder="Ejemplo: 30% de descuento en hamburguesa xtreme">${offerText}</textarea>
      <div class="reward-offer-actions">
        <select class="auth-input reward-offer-level">
          ${[1, 2, 3, 4, 5].map((level) => `<option value="${level}"${level === requiredLevel ? ' selected' : ''}>Nivel ${level}</option>`).join('')}
        </select>
        <button type="button" class="modal-btn-secondary reward-offer-remove-btn">Quitar</button>
      </div>
    </article>
  `;
}

function renderRewardOfferFields(offers = []) {
  const container = document.getElementById('reward-offers-form-list');
  if (!container) return;

  const normalizedOffers = normalizeRewardOffers(offers);
  const offersToRender = normalizedOffers.length ? normalizedOffers : [{ offerText: '', requiredLevel: 1 }];
  container.innerHTML = offersToRender.map((offer) => createRewardOfferFieldMarkup(offer)).join('');
}

function areOffersEnabled() {
  return document.querySelector('input[name="business-has-offers"]:checked')?.value === 'yes';
}

function setOffersEnabled(enabled, { keepValues = true } = {}) {
  const rewardSection = document.getElementById('reward-offers-section');
  const yesOption = document.querySelector('input[name="business-has-offers"][value="yes"]');
  const noOption = document.querySelector('input[name="business-has-offers"][value="no"]');

  if (yesOption) yesOption.checked = !!enabled;
  if (noOption) noOption.checked = !enabled;
  if (rewardSection) rewardSection.hidden = !enabled;

  if (enabled) {
    const rows = document.querySelectorAll('.reward-offer-row');
    if (!rows.length) {
      renderRewardOfferFields();
    }
  } else if (!keepValues) {
    renderRewardOfferFields([]);
  }
}

function collectRewardOffers() {
  return Array.from(document.querySelectorAll('.reward-offer-row')).reduce((offers, row) => {
    const offerText = row.querySelector('.reward-offer-text')?.value.trim() || '';
    const requiredLevel = Number(row.querySelector('.reward-offer-level')?.value || 0);

    if (!offerText) {
      return offers;
    }

    if (!requiredLevel || requiredLevel < 1 || requiredLevel > 5) {
      throw new Error('Selecciona un nivel válido para cada oferta.');
    }

    offers.push({ offerText, requiredLevel });
    return offers;
  }, []);
}

function updateLocationSummary() {
  const summary = document.getElementById('business-location-summary');
  const modalSummary = document.getElementById('location-picker-coordinates');
  const latInput = document.getElementById('business-lat');
  const lngInput = document.getElementById('business-lng');
  const lat = Number(latInput?.value);
  const lng = Number(lngInput?.value);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const text = hasLocation
    ? `Ubicación seleccionada: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    : 'Todavía no seleccionas la ubicación del negocio.';

  if (summary) summary.textContent = text;
  if (modalSummary) modalSummary.textContent = hasLocation ? `Centro actual del mapa: ${lat.toFixed(6)}, ${lng.toFixed(6)}` : text;
}

function updateBusinessPhotoSelectionSummary() {
  const summary = document.getElementById('business-photo-selection-summary');
  if (!summary) return;

  if (!state.selectedBusinessPhotoFiles.length) {
    summary.textContent = 'Aún no seleccionas fotos nuevas.';
    return;
  }

  summary.textContent = `${state.selectedBusinessPhotoFiles.length} foto(s) nueva(s) lista(s) para subirse.`;
}

function setSelectedLocation(lat, lng, { syncMap = false } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  state.selectedLocation = { lat, lng };
  const latInput = document.getElementById('business-lat');
  const lngInput = document.getElementById('business-lng');
  if (latInput) latInput.value = String(lat);
  if (lngInput) lngInput.value = String(lng);
  updateLocationSummary();

  if (syncMap && state.locationPickerMap) {
    state.locationPickerMap.setView([lat, lng], Math.max(state.locationPickerMap.getZoom(), LOCATION_PICKER_ZOOM));
  }
}

function updateCurrentLocationMarker(lat, lng) {
  if (!state.locationPickerMap || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  if (!state.locationPickerCurrentMarker) {
    state.locationPickerCurrentMarker = L.marker([lat, lng], { icon: createCurrentLocationIcon(), zIndexOffset: 1000 })
      .addTo(state.locationPickerMap)
      .bindPopup('Tu ubicación actual');
    return;
  }

  state.locationPickerCurrentMarker.setLatLng([lat, lng]);
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    throw new Error('Tu navegador no permite obtener la ubicación actual.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => {
        reject(new Error('No se pudo obtener tu ubicación actual. Revisa los permisos del navegador.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

async function useCurrentLocation() {
  const button = document.getElementById('location-picker-current-btn');
  const idleLabel = 'Usar mi ubicación actual';
  if (button) {
    button.disabled = true;
    button.textContent = 'Ubicando...';
  }

  try {
    const current = await getCurrentLocation();
    updateCurrentLocationMarker(current.lat, current.lng);
    setSelectedLocation(current.lat, current.lng, { syncMap: true });
    state.locationPickerCurrentMarker?.openPopup();
  } catch (error) {
    await ui.error({ title: 'Ubicación no disponible', text: error.message });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = idleLabel;
    }
  }
}

function renderBusinessPhotoPreviews(urls = []) {
  const previewList = document.getElementById('business-photo-preview-list');
  if (!previewList) return;

  const selectedFiles = state.selectedBusinessPhotoFiles;
  updateBusinessPhotoSelectionSummary();

  if (!selectedFiles.length && !urls.length) {
    previewList.innerHTML = '<p class="detail-description-text">Aún no agregas fotos del negocio.</p>';
    return;
  }

  const selectedMarkup = selectedFiles.map((file) => `
    <article class="business-photo-preview-card">
      <img src="${URL.createObjectURL(file)}" alt="Vista previa de foto seleccionada" />
      <p>${escapeHtml(file.name)}</p>
      <button type="button" class="business-photo-remove-btn modal-btn-secondary" data-photo-index="${selectedFiles.indexOf(file)}">Quitar</button>
    </article>
  `).join('');

  const existingMarkup = !selectedFiles.length
    ? urls.map((url, index) => `
        <article class="business-photo-preview-card">
          <img src="${escapeHtml(url)}" alt="Foto actual del negocio ${index + 1}" />
          <p>Foto actual ${index + 1}</p>
        </article>
      `).join('')
    : '';

  previewList.innerHTML = selectedMarkup || existingMarkup;
}

function appendBusinessPhotoFiles(fileList) {
  const nextFiles = Array.from(fileList || []).filter((file) => file && file.size > 0);
  if (!nextFiles.length) return;

  const existingKeys = new Set(state.selectedBusinessPhotoFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  nextFiles.forEach((file) => {
    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    if (!existingKeys.has(fileKey)) {
      state.selectedBusinessPhotoFiles.push(file);
      existingKeys.add(fileKey);
    }
  });
}

function removeBusinessPhotoFile(fileIndex) {
  state.selectedBusinessPhotoFiles = state.selectedBusinessPhotoFiles.filter((_, index) => index !== fileIndex);
}

function openLocationPickerModal() {
  const backdrop = document.getElementById('location-picker-modal');
  if (!backdrop) return;
  backdrop.removeAttribute('hidden');

  const lat = Number(document.getElementById('business-lat')?.value);
  const lng = Number(document.getElementById('business-lng')?.value);
  const fallback = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : (state.selectedLocation || DEFAULT_LOCATION);

  if (!state.locationPickerMap) {
    state.locationPickerMap = L.map('location-picker-map', { zoomControl: true }).setView([fallback.lat, fallback.lng], LOCATION_PICKER_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.locationPickerMap);

    state.locationPickerMap.on('moveend', () => {
      const center = state.locationPickerMap.getCenter();
      setSelectedLocation(center.lat, center.lng);
    });
  } else {
    state.locationPickerMap.setView([fallback.lat, fallback.lng], Math.max(state.locationPickerMap.getZoom(), LOCATION_PICKER_ZOOM));
  }

  setTimeout(() => state.locationPickerMap?.invalidateSize(), 60);

  setSelectedLocation(fallback.lat, fallback.lng, { syncMap: false });

  if (!document.getElementById('business-lat')?.value && !document.getElementById('business-lng')?.value) {
    void useCurrentLocation();
  }
}

function closeLocationPickerModal() {
  document.getElementById('location-picker-modal')?.setAttribute('hidden', '');
}

function collectBusinessPayload() {
  const whatsappDigits = normalizeDigits(document.getElementById('business-whatsapp')?.value.trim());
  const photoFiles = [...state.selectedBusinessPhotoFiles];
  const latitude = Number(document.getElementById('business-lat')?.value);
  const longitude = Number(document.getElementById('business-lng')?.value);

  const payload = {
    name: document.getElementById('business-name')?.value.trim(),
    description: document.getElementById('business-description')?.value.trim(),
    categoryId: Number(document.getElementById('business-category')?.value || 0),
    latitude,
    longitude,
    whatsappNumber: whatsappDigits,
    photoFiles,
    rewardOffers: areOffersEnabled() ? collectRewardOffers() : []
  };

  if (!payload.name || !payload.description || !payload.categoryId) {
    throw new Error('Completa todos los datos del negocio antes de guardar.');
  }

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    throw new Error('La latitud y longitud del negocio son obligatorias.');
  }

  if (payload.whatsappNumber.length !== 10) {
    throw new Error('El WhatsApp del negocio debe tener 10 dígitos.');
  }

  if (!state.editingBusinessId && !payload.photoFiles.length) {
    throw new Error('Agrega al menos una foto del negocio antes de guardarlo.');
  }

  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('description', payload.description);
  formData.append('categoryId', String(payload.categoryId));
  formData.append('latitude', String(payload.latitude));
  formData.append('longitude', String(payload.longitude));
  formData.append('whatsappNumber', payload.whatsappNumber);
  formData.append('rewardOffersJson', JSON.stringify(payload.rewardOffers));
  payload.photoFiles.forEach((file) => {
    formData.append('photoFiles', file);
  });

  return formData;
}

function resetBusinessForm() {
  document.getElementById('business-form')?.reset();
  state.editingBusinessId = null;
  state.selectedLocation = null;
  state.selectedBusinessPhotoFiles = [];
  const latInput = document.getElementById('business-lat');
  const lngInput = document.getElementById('business-lng');
  if (latInput) latInput.value = '';
  if (lngInput) lngInput.value = '';
  setOffersEnabled(false, { keepValues: false });
  renderBusinessPhotoPreviews();
  updateLocationSummary();
  const cancelBtn = document.getElementById('business-cancel-btn');
  if (cancelBtn) cancelBtn.hidden = true;
  const submitBtn = document.getElementById('business-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Guardar negocio';
}

function renderBusinessCategoryOptions() {
  const select = document.getElementById('business-category');
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecciona una categoría</option>
    ${state.categories.map((category) => `<option value="${category.id}">${humanizeCategory(category.name)}</option>`).join('')}
  `;
}

function fillBusinessForm(business) {
  document.getElementById('business-name').value = business.name || '';
  document.getElementById('business-description').value = business.description || '';
  document.getElementById('business-category').value = state.categories.find((category) => category.name === business.categoryName)?.id || '';
  setSelectedLocation(Number(business.latitude), Number(business.longitude));
  document.getElementById('business-whatsapp').value = business.whatsappNumber || '';
  const photoInput = document.getElementById('business-photo-files');
  if (photoInput) photoInput.value = '';
  state.selectedBusinessPhotoFiles = [];
  renderBusinessPhotoPreviews(Array.isArray(business.photoUrls) ? business.photoUrls : []);
  setOffersEnabled((business.rewardOffers || []).length > 0, { keepValues: true });
  renderRewardOfferFields(business.rewardOffers || []);
  state.editingBusinessId = business.id;
  const cancelBtn = document.getElementById('business-cancel-btn');
  if (cancelBtn) cancelBtn.hidden = false;
  const submitBtn = document.getElementById('business-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Actualizar negocio';
}

function renderProductForm(businessId) {
  const isActive = state.activeProductFormBusinessId === businessId;
  return `
    <section class="product-form-shell${isActive ? '' : ' product-form-shell--hidden'}">
      <form class="auth-form product-form" data-business-id="${businessId}" data-product-id="">
        <input class="auth-input product-name" type="text" placeholder="Nombre del producto" required />
        <textarea class="auth-input detail-textarea product-description" placeholder="Descripción del producto" required></textarea>
        <input class="auth-input product-price" type="number" step="0.01" min="0" placeholder="Precio" required />
        <input class="auth-input product-photo-files" type="file" accept="image/*" multiple />
        <div class="product-photo-preview-list"><p class="detail-description-text">Aún no agregas imágenes del producto.</p></div>
        <div class="profile-actions-row">
          <button type="submit" class="btn-primary profile-main-btn">Guardar producto</button>
          <button type="button" class="modal-btn-secondary product-cancel-btn">Cancelar</button>
        </div>
      </form>
    </section>
  `;
}

function renderProductPhotoPreviews(form, existingUrls = []) {
  const container = form?.querySelector('.product-photo-preview-list');
  const selectedFiles = Array.from(form?.querySelector('.product-photo-files')?.files || []);
  if (!container) return;

  if (!selectedFiles.length && !existingUrls.length) {
    container.innerHTML = '<p class="detail-description-text">Aún no agregas imágenes del producto.</p>';
    return;
  }

  const selectedMarkup = selectedFiles.map((file) => `
    <article class="business-photo-preview-card">
      <img src="${URL.createObjectURL(file)}" alt="Vista previa de imagen del producto" />
      <p>${escapeHtml(file.name)}</p>
    </article>
  `).join('');

  const existingMarkup = !selectedFiles.length
    ? existingUrls.map((url, index) => `
        <article class="business-photo-preview-card">
          <img src="${escapeHtml(url)}" alt="Imagen actual del producto ${index + 1}" />
          <p>Imagen actual ${index + 1}</p>
        </article>
      `).join('')
    : '';

  container.innerHTML = selectedMarkup || existingMarkup;
}

function openProductForm(businessId) {
  state.activeProductFormBusinessId = businessId;
  renderMerchantBusinesses();
}

function closeProductForm(form) {
  state.activeProductFormBusinessId = null;
  if (form) {
    form.reset();
    form.dataset.productId = '';
  }
  renderMerchantBusinesses();
}

function renderRewardOffersSummary(rewardOffers) {
  const normalizedOffers = normalizeRewardOffers(rewardOffers);
  if (!normalizedOffers.length) {
    return '<p class="detail-description-text">Aún no configuraste promociones por nivel.</p>';
  }

  return normalizedOffers.map((offer) => `
    <article class="reward-offer-summary">
      <span class="detail-pill">Nivel ${offer.requiredLevel}</span>
      <p>${escapeHtml(offer.offerText)}</p>
    </article>
  `).join('');
}

function renderQrPanel(business) {
  const qrData = state.businessQrById[business.id];
  return `
    <section class="merchant-qr-card">
      <div class="merchant-qr-header">
        <div>
          <h4 class="profile-subtitle">Código QR del local</h4>
          <p class="profile-helper-text">Imprímelo y colócalo en el negocio. Cada escaneo válido suma 50% al progreso del turista.</p>
        </div>
        <span class="detail-pill">2 visitas por nivel</span>
      </div>
      <div class="merchant-qr-layout">
        <div id="merchant-qr-code-${business.id}" class="merchant-qr-preview" data-qr-business-id="${business.id}"></div>
        <div class="merchant-qr-copy">
          <p class="detail-description-text">${qrData ? 'QR listo para impresión.' : 'Preparando código QR...'}</p>
          <div class="profile-actions-row">
            <button type="button" class="modal-btn-secondary" data-action="download-qr-pdf" data-business-id="${business.id}">Descargar PDF</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMerchantBusinesses() {
  const container = document.getElementById('merchant-businesses-list');
  if (!container) return;

  if (!state.businesses.length) {
    container.innerHTML = '<p class="detail-description-text" style="color: var(--color-text-light);">Aún no tienes negocios registrados.</p>';
    return;
  }

  container.innerHTML = state.businesses.map((business) => `
    <article class="detail-record detail-record--column" data-business-id="${business.id}">
      <div class="detail-record-header">
        <div>
          <strong>${escapeHtml(business.name)}</strong>
          <p>${humanizeCategory(business.categoryName)} · ${business.verified ? 'Verificado' : 'Pendiente de validación'}</p>
        </div>
        <span class="detail-pill">${business.averageRating ? Number(business.averageRating).toFixed(1) : 'Nuevo'}</span>
      </div>
      <p>${escapeHtml(business.description || 'Sin descripción.')}</p>
      <p>WhatsApp: ${escapeHtml(business.whatsappNumber || 'Sin registro')}</p>
      <div class="merchant-reward-block">
        <h4 class="profile-subtitle">Promociones configuradas</h4>
        <div class="detail-stack">
          ${renderRewardOffersSummary(business.rewardOffers || [])}
        </div>
      </div>
      ${renderQrPanel(business)}
      <div class="profile-actions-row">
        <button type="button" class="modal-btn-secondary" data-action="edit-business" data-business-id="${business.id}">Editar</button>
        <button type="button" class="modal-btn-secondary" data-action="delete-business" data-business-id="${business.id}">Eliminar</button>
      </div>
      <div class="profile-actions-row">
        <button type="button" class="btn-primary profile-main-btn" data-action="open-product-form" data-business-id="${business.id}">Agregar producto</button>
      </div>
      <div class="detail-stack">
        ${(business.products || []).length
          ? business.products.map((product) => `
              <article class="detail-record">
                <div>
                  <strong>${escapeHtml(product.name)}</strong>
                  <p>${escapeHtml(product.description || 'Sin descripción.')}</p>
                  ${(product.photosUrl || []).length ? `<div class="product-inline-photo-list">${product.photosUrl.map((url, index) => `<img src="${escapeHtml(url)}" alt="Imagen del producto ${index + 1}" class="product-inline-photo" />`).join('')}</div>` : ''}
                </div>
                <div class="detail-stack-inline">
                  <span class="detail-pill">$${Number(product.price || 0).toFixed(2)}</span>
                  <button type="button" class="modal-btn-secondary" data-action="edit-product" data-business-id="${business.id}" data-product-id="${product.id}">Editar</button>
                  <button type="button" class="modal-btn-secondary" data-action="delete-product" data-business-id="${business.id}" data-product-id="${product.id}">Eliminar</button>
                </div>
              </article>
            `).join('')
          : '<p class="detail-description-text" style="color: var(--color-text-light);">Todavía no hay productos para este negocio.</p>'}
      </div>
      ${renderProductForm(business.id)}
    </article>
  `).join('');

  renderQrCodes();
}

function renderQrCodes() {
  if (!window.QRCode) return;

  Object.entries(state.businessQrById).forEach(([businessId, qrData]) => {
    const container = document.getElementById(`merchant-qr-code-${businessId}`);
    if (!container || container.dataset.qrContent === qrData.qrContent) return;

    container.innerHTML = '';
    container.dataset.qrContent = qrData.qrContent;
    new window.QRCode(container, {
      text: qrData.qrContent,
      width: 164,
      height: 164,
      correctLevel: window.QRCode.CorrectLevel.H
    });
  });
}

function getQrElementDataUrl(businessId) {
  const container = document.getElementById(`merchant-qr-code-${businessId}`);
  const canvas = container?.querySelector('canvas');
  const image = container?.querySelector('img');
  if (canvas) return canvas.toDataURL('image/png');
  if (image) return image.src;
  return null;
}

async function downloadQrPdf(businessId) {
  const qrData = state.businessQrById[businessId];
  const business = state.businesses.find((item) => item.id === businessId);
  const imageData = getQrElementDataUrl(businessId);

  if (!qrData || !business || !imageData || !window.jspdf?.jsPDF) {
    throw new Error('El QR todavía no está listo para descargarse.');
  }

  const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  pdf.setFillColor(16, 69, 120);
  pdf.rect(0, 0, 595, 88, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text('SelloDoradoMX', 40, 52);

  pdf.setTextColor(26, 26, 26);
  pdf.setFontSize(18);
  pdf.text(business.name || 'Negocio', 40, 130);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text('Imprime este QR y colócalo en tu local para registrar visitas válidas.', 40, 152);

  pdf.addImage(imageData, 'PNG', 40, 185, 190, 190);
  pdf.setFontSize(10);
  pdf.text(`Código: ${qrData.qrContent}`, 40, 398, { maxWidth: 520 });
  pdf.text('Regla de progreso: cada escaneo suma 50%. Dos visitas suben un nivel.', 40, 420, { maxWidth: 520 });

  pdf.save(`qr-${(business.name || 'negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

function getCurrentUser() {
  return apiRequest('/users/me');
}

function getBusinessCategories() {
  return apiRequest('/business-categories', { headers: {} });
}

function getBusinessesByUser(userId) {
  return apiRequest(`/businesses/user/${userId}`);
}

function getProductsByBusiness(businessId) {
  return apiRequest(`/products/business/${businessId}`);
}

function getBusinessQr(businessId) {
  return apiRequest(`/businesses/${businessId}/qr`);
}

function saveBusiness(payload) {
  if (state.editingBusinessId) {
    return apiRequest(`/businesses/${state.editingBusinessId}`, { method: 'PUT', body: payload, useJson: false });
  }

  return apiRequest('/businesses', { method: 'POST', body: payload, useJson: false });
}

function deleteBusiness(businessId) {
  return apiRequest(`/businesses/${businessId}`, { method: 'DELETE' });
}

function saveProduct(payload, productId) {
  if (productId) {
    return apiRequest(`/products/${productId}`, { method: 'PUT', body: payload, useJson: false });
  }

  return apiRequest('/products', { method: 'POST', body: payload, useJson: false });
}

function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, { method: 'DELETE' });
}

async function hydrateBusinesses() {
  const businesses = await getBusinessesByUser(state.currentUser.id);
  const hydratedBusinesses = await Promise.all((businesses || []).map(async (business) => {
    const products = await getProductsByBusiness(business.id).catch(() => []);
    return {
      ...business,
      rewardOffers: normalizeRewardOffers(business.rewardOffers || []),
      products
    };
  }));

  const qrEntries = await Promise.all(hydratedBusinesses.map(async (business) => {
    try {
      return [business.id, await getBusinessQr(business.id)];
    } catch {
      return [business.id, null];
    }
  }));

  state.businesses = hydratedBusinesses;
  state.businessQrById = Object.fromEntries(qrEntries.filter(([, qr]) => qr));
  renderMerchantBusinesses();
}

async function loadMerchantDashboard() {
  state.categories = await getBusinessCategories();
  renderBusinessCategoryOptions();
  renderRewardOfferFields();
  await hydrateBusinesses();
}

function mountEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', clearSessionAndGoAuth);
  document.getElementById('back-to-profile-btn')?.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  document.getElementById('business-cancel-btn')?.addEventListener('click', resetBusinessForm);
  document.getElementById('open-location-picker-btn')?.addEventListener('click', openLocationPickerModal);
  document.getElementById('location-picker-current-btn')?.addEventListener('click', () => {
    void useCurrentLocation();
  });
  document.getElementById('location-picker-close-btn')?.addEventListener('click', closeLocationPickerModal);
  document.getElementById('location-picker-cancel-btn')?.addEventListener('click', closeLocationPickerModal);
  document.getElementById('location-picker-confirm-btn')?.addEventListener('click', () => {
    if (state.locationPickerMap) {
      const center = state.locationPickerMap.getCenter();
      setSelectedLocation(center.lat, center.lng);
    }
    closeLocationPickerModal();
  });
  document.getElementById('location-picker-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'location-picker-modal') {
      closeLocationPickerModal();
    }
  });
  document.getElementById('business-photo-files')?.addEventListener('change', () => {
    const input = document.getElementById('business-photo-files');
    appendBusinessPhotoFiles(input?.files || []);
    if (input) input.value = '';
    renderBusinessPhotoPreviews(state.editingBusinessId
      ? (state.businesses.find((business) => business.id === state.editingBusinessId)?.photoUrls || [])
      : []);
  });
  document.getElementById('business-photo-preview-list')?.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.business-photo-remove-btn');
    if (!removeBtn) return;

    removeBusinessPhotoFile(Number(removeBtn.dataset.photoIndex || -1));
    renderBusinessPhotoPreviews(state.editingBusinessId
      ? (state.businesses.find((business) => business.id === state.editingBusinessId)?.photoUrls || [])
      : []);
  });
  document.getElementById('business-offers-decision-group')?.addEventListener('change', () => {
    setOffersEnabled(areOffersEnabled(), { keepValues: true });
  });
  document.getElementById('merchant-businesses-list')?.addEventListener('change', (event) => {
    const input = event.target.closest('.product-photo-files');
    if (!input) return;
    const form = input.closest('.product-form');
    const businessId = Number(form?.dataset.businessId || 0);
    const business = state.businesses.find((item) => item.id === businessId);
    const productId = Number(form?.dataset.productId || 0);
    const product = (business?.products || []).find((item) => item.id === productId);
    renderProductPhotoPreviews(form, product?.photosUrl || []);
  });
  document.getElementById('add-offer-btn')?.addEventListener('click', () => {
    const container = document.getElementById('reward-offers-form-list');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', createRewardOfferFieldMarkup({ offerText: '', requiredLevel: 1 }));
  });

  document.getElementById('reward-offers-form-list')?.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.reward-offer-remove-btn');
    if (!removeBtn) return;

    const rows = document.querySelectorAll('.reward-offer-row');
    if (rows.length <= 1) {
      const row = removeBtn.closest('.reward-offer-row');
      const offerTextInput = row?.querySelector('.reward-offer-text');
      const offerLevelSelect = row?.querySelector('.reward-offer-level');
      if (offerTextInput) offerTextInput.value = '';
      if (offerLevelSelect) offerLevelSelect.value = '1';
      return;
    }

    removeBtn.closest('.reward-offer-row')?.remove();
  });

  document.getElementById('business-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const idleLabel = state.editingBusinessId ? 'Actualizar negocio' : 'Guardar negocio';
    setButtonLoading('business-submit-btn', true, idleLabel, 'Guardando...');

    try {
      const payload = collectBusinessPayload();
      await saveBusiness(payload);
      resetBusinessForm();
      await hydrateBusinesses();
      await ui.toast({ title: 'Negocio guardado correctamente.' });
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionError();
        return;
      }
      await ui.error({ title: 'No se pudo guardar el negocio', text: error.message });
    } finally {
      setButtonLoading('business-submit-btn', false, state.editingBusinessId ? 'Actualizar negocio' : 'Guardar negocio', 'Guardando...');
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const businessId = Number(event.target.closest('[data-business-id]')?.dataset.businessId || event.target.dataset.businessId || 0);
    const productId = Number(event.target.dataset.productId || 0);
    const business = state.businesses.find((item) => item.id === businessId);

    if (!action) return;

    try {
      if (action === 'download-qr-pdf') {
        await downloadQrPdf(businessId);
        await ui.toast({ title: 'PDF generado correctamente.' });
        return;
      }

      if (!business) return;

      if (action === 'open-product-form') {
        openProductForm(businessId);
        return;
      }

      if (action === 'edit-business') {
        fillBusinessForm(business);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (action === 'delete-business') {
        const confirmed = await ui.confirm({
          title: 'Eliminar negocio',
          text: 'Esta acción quitará el negocio y no se puede deshacer.',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmed) return;
        await deleteBusiness(businessId);
        await hydrateBusinesses();
        await ui.toast({ title: 'Negocio eliminado correctamente.' });
      }

      if (action === 'edit-product') {
        const product = (business.products || []).find((item) => item.id === productId);
        const card = event.target.closest('[data-business-id]');
        const form = card?.querySelector('.product-form');
        if (!product || !form) return;
        state.activeProductFormBusinessId = business.id;
        renderMerchantBusinesses();
        const refreshedCard = document.querySelector(`[data-business-id="${business.id}"]`);
        const refreshedForm = refreshedCard?.querySelector('.product-form');
        if (!refreshedForm) return;
        refreshedForm.dataset.productId = String(product.id);
        refreshedForm.querySelector('.product-name').value = product.name || '';
        refreshedForm.querySelector('.product-description').value = product.description || '';
        refreshedForm.querySelector('.product-price').value = product.price ?? '';
        refreshedForm.querySelector('.product-photo-files').value = '';
        renderProductPhotoPreviews(refreshedForm, product.photosUrl || []);
        refreshedForm.querySelector('button[type="submit"]').textContent = 'Actualizar producto';
      }

      if (action === 'delete-product') {
        const confirmed = await ui.confirm({
          title: 'Eliminar producto',
          text: 'Esta acción quitará el producto de tu negocio.',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmed) return;
        await deleteProduct(productId);
        await hydrateBusinesses();
        await ui.toast({ title: 'Producto eliminado correctamente.' });
      }
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionError();
        return;
      }
      await ui.error({ title: 'No se pudo completar la acción', text: error.message });
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.product-form');
    if (!form) return;

    event.preventDefault();
    const businessId = Number(form.dataset.businessId || 0);
    const productId = Number(form.dataset.productId || 0) || null;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = productId ? 'Actualizando...' : 'Guardando...';

    try {
      const payload = {
          businessId,
          name: form.querySelector('.product-name').value.trim(),
          description: form.querySelector('.product-description').value.trim(),
          price: Number(form.querySelector('.product-price').value),
          photoFiles: Array.from(form.querySelector('.product-photo-files')?.files || [])
        };

      if (!payload.name || !payload.description || !Number.isFinite(payload.price)) {
        throw new Error('Completa los datos del producto antes de guardar.');
      }

        const formData = new FormData();
        formData.append('businessId', String(payload.businessId));
        formData.append('name', payload.name);
        formData.append('description', payload.description);
        formData.append('price', String(payload.price));
        payload.photoFiles.forEach((file) => {
          formData.append('photoFiles', file);
        });

        await saveProduct(formData, productId);
        state.activeProductFormBusinessId = null;
      await hydrateBusinesses();
      await ui.toast({ title: 'Producto guardado correctamente.' });
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionError();
        return;
      }
      await ui.error({ title: 'No se pudo guardar el producto', text: error.message });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = form.dataset.productId ? 'Actualizar producto' : 'Guardar producto';
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('click', (event) => {
    const cancelBtn = event.target.closest('.product-cancel-btn');
    if (!cancelBtn) return;

    const form = cancelBtn.closest('.product-form');
    closeProductForm(form);
  });
}

async function initBusinessPage() {
  if (!getToken()) {
    window.location.href = 'auth.html';
    return;
  }

  mountEvents();
  renderRewardOfferFields();
  renderBusinessPhotoPreviews();
  updateLocationSummary();

  try {
    const user = await getCurrentUser();
    state.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    setUserUi(user);

    if (user.roleName === 'ROLE_ADMIN') {
      window.location.replace('admin.html');
      return;
    }

    if (user.roleName !== 'ROLE_MERCHANT') {
      await ui.alert({ title: 'Acceso restringido', text: 'Primero necesitas tener una cuenta de negocio aprobada.' });
      window.location.replace('profile.html');
      return;
    }

    await loadMerchantDashboard();
  } catch (error) {
    console.error('[SelloDoradoMX] Error en mis negocios', error);
    if (isSessionError(error)) {
      await handleSessionError();
      return;
    }
    await ui.error({ title: 'No se pudieron cargar tus negocios', text: 'Intenta de nuevo en unos momentos.' });
  }
}

_apiReady.then(() => initBusinessPage());