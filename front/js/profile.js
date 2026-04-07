const API_BASE_URL = 'http://localhost:8080/api/v1';
const MAX_IDENTIFICATION_IMAGE_BYTES = 10 * 1024 * 1024;
const state = {
  currentUser: null,
  categories: [],
  businesses: [],
  editingBusinessId: null
};

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

function getJsonAuthHeaders() {
  return {
    ...getAuthHeaders(),
    'Content-Type': 'application/json'
  };
}

function clearSessionAndGoAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('tokenType');
  localStorage.removeItem('currentUser');
  window.location.href = 'auth.html';
}

function roleToLabel(roleName) {
  if (roleName === 'ROLE_MERCHANT') return 'Merchant';
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

  const options = {
    method,
    headers: requestHeaders
  };

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
  const fullName = `${user?.name || ''} ${user?.lastname || ''}`.trim() || 'Usuario';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const nameEl = document.getElementById('profile-name');
  const roleEl = document.getElementById('profile-role');
  const avatarEl = document.getElementById('profile-avatar');

  if (nameEl) nameEl.textContent = fullName;
  if (roleEl) roleEl.textContent = roleToLabel(user?.roleName);
  if (avatarEl) avatarEl.textContent = initials;
}

function setStatus(message) {
  const section = document.getElementById('merchant-status-section');
  const text = document.getElementById('merchant-status-message');
  if (!section || !text) return;
  text.textContent = message;
  section.hidden = false;
}

function showSection(id) {
  const section = document.getElementById(id);
  if (section) section.hidden = false;
}

function hideSection(id) {
  const section = document.getElementById(id);
  if (section) section.hidden = true;
}

function setButtonLoading(buttonId, loading, idleLabel, loadingLabel) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingLabel : idleLabel;
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function validateMerchantForm(data) {
  if (!data.curp || !data.phone || !data.storeName) {
    throw new Error('Completa todos los campos del Merchant Profile');
  }

  if (normalizeDigits(data.phone).length !== 10) {
    throw new Error('El teléfono debe tener 10 dígitos');
  }
}

function collectBusinessPayload() {
  const whatsappDigits = normalizeDigits(document.getElementById('business-whatsapp')?.value.trim());
  const photoUrls = (document.getElementById('business-photos')?.value || '')
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = {
    name: document.getElementById('business-name')?.value.trim(),
    description: document.getElementById('business-description')?.value.trim(),
    categoryId: Number(document.getElementById('business-category')?.value || 0),
    latitude: Number(document.getElementById('business-lat')?.value),
    longitude: Number(document.getElementById('business-lng')?.value),
    whatsappNumber: whatsappDigits,
    photoUrls
  };

  if (!payload.name || !payload.description || !payload.categoryId || !payload.photoUrls.length) {
    throw new Error('Completa todos los datos del negocio antes de guardar.');
  }

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    throw new Error('La latitud y longitud del negocio son obligatorias.');
  }

  if (payload.whatsappNumber.length !== 10) {
    throw new Error('El WhatsApp del negocio debe tener 10 dígitos.');
  }

  return payload;
}

function resetBusinessForm() {
  const form = document.getElementById('business-form');
  if (form) form.reset();
  state.editingBusinessId = null;
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
  document.getElementById('business-lat').value = business.latitude ?? '';
  document.getElementById('business-lng').value = business.longitude ?? '';
  document.getElementById('business-whatsapp').value = business.whatsappNumber || '';
  document.getElementById('business-photos').value = Array.isArray(business.photoUrls) ? business.photoUrls.join('\n') : '';
  state.editingBusinessId = business.id;
  const cancelBtn = document.getElementById('business-cancel-btn');
  if (cancelBtn) cancelBtn.hidden = false;
  const submitBtn = document.getElementById('business-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Actualizar negocio';
}

function renderProductForm(businessId) {
  return `
    <form class="auth-form product-form" data-business-id="${businessId}" data-product-id="">
      <input class="auth-input product-name" type="text" placeholder="Nombre del producto" required />
      <textarea class="auth-input detail-textarea product-description" placeholder="Descripción del producto" required></textarea>
      <input class="auth-input product-price" type="number" step="0.01" min="0" placeholder="Precio" required />
      <textarea class="auth-input detail-textarea product-photos" placeholder="URLs de fotos del producto, una por línea"></textarea>
      <div class="profile-actions-row">
        <button type="submit" class="btn-primary profile-main-btn">Guardar producto</button>
        <button type="button" class="modal-btn-secondary product-cancel-btn" hidden>Cancelar</button>
      </div>
    </form>
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
          <strong>${business.name}</strong>
          <p>${humanizeCategory(business.categoryName)} · ${business.verified ? 'Verificado' : 'Pendiente de validación'}</p>
        </div>
        <span class="detail-pill">${business.averageRating ? business.averageRating.toFixed(1) : 'Nuevo'}</span>
      </div>
      <p>${business.description || 'Sin descripción.'}</p>
      <p>WhatsApp: ${business.whatsappNumber || 'Sin registro'}</p>
      <div class="profile-actions-row">
        <button type="button" class="modal-btn-secondary business-edit-btn" data-action="edit-business" data-business-id="${business.id}">Editar</button>
        <button type="button" class="modal-btn-secondary business-delete-btn" data-action="delete-business" data-business-id="${business.id}">Eliminar</button>
      </div>
      <div class="detail-stack">
        ${(business.products || []).length
          ? business.products.map((product) => `
              <article class="detail-record">
                <div>
                  <strong>${product.name}</strong>
                  <p>${product.description || 'Sin descripción.'}</p>
                </div>
                <div class="detail-stack-inline">
                  <span class="detail-pill">$${Number(product.price || 0).toFixed(2)}</span>
                  <button type="button" class="modal-btn-secondary product-edit-btn" data-action="edit-product" data-business-id="${business.id}" data-product-id="${product.id}">Editar</button>
                  <button type="button" class="modal-btn-secondary product-delete-btn" data-action="delete-product" data-business-id="${business.id}" data-product-id="${product.id}">Eliminar</button>
                </div>
              </article>
            `).join('')
          : '<p class="detail-description-text" style="color: var(--color-text-light);">Todavía no hay productos para este negocio.</p>'}
      </div>
      ${renderProductForm(business.id)}
    </article>
  `).join('');
}

async function getCurrentUser() {
  return apiRequest('/users/me');
}

async function getMerchantProfileByUserId(userId) {
  try {
    return await apiRequest(`/users/${userId}/merchant-profile`);
  } catch (error) {
    if (error.message === 'SESSION_INVALID') throw error;
    if (error.message.toLowerCase().includes('no encontrado')) return null;
    return null;
  }
}

async function createMerchantProfile(payload, identificationImage) {
  const formData = new FormData();
  formData.append('curp', payload.curp);
  formData.append('phone', payload.phone);
  formData.append('storeName', payload.storeName);
  formData.append('identificationImage', identificationImage);

  return apiRequest('/users/merchant-profiles', {
    method: 'POST',
    body: formData,
    useJson: false
  });
}

async function loadMerchantImage(userId, imageEl = document.getElementById('merchant-saved-image')) {
  if (!imageEl) return;

  const response = await fetch(`${API_BASE_URL}/users/${userId}/merchant-profile/image`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) return;
  const blob = await response.blob();
  imageEl.src = URL.createObjectURL(blob);
  imageEl.hidden = false;
}

async function getBusinessCategories() {
  return apiRequest('/business-categories', { headers: {} });
}

async function getBusinessesByUser(userId) {
  return apiRequest(`/businesses/user/${userId}`);
}

async function getProductsByBusiness(businessId) {
  return apiRequest(`/products/business/${businessId}`);
}

async function saveBusiness(payload) {
  if (state.editingBusinessId) {
    return apiRequest(`/businesses/${state.editingBusinessId}`, { method: 'PUT', body: payload });
  }

  return apiRequest('/businesses', { method: 'POST', body: payload });
}

async function deleteBusiness(businessId) {
  return apiRequest(`/businesses/${businessId}`, { method: 'DELETE' });
}

async function saveProduct(payload, productId) {
  if (productId) {
    return apiRequest(`/products/${productId}`, { method: 'PUT', body: payload });
  }

  return apiRequest('/products', { method: 'POST', body: payload });
}

async function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, { method: 'DELETE' });
}

async function hydrateBusinesses() {
  const businesses = await getBusinessesByUser(state.currentUser.id);
  const hydratedBusinesses = await Promise.all((businesses || []).map(async (business) => {
    const products = await getProductsByBusiness(business.id).catch(() => []);
    return { ...business, products };
  }));

  state.businesses = hydratedBusinesses;
  renderMerchantBusinesses();
}

async function loadMerchantDashboard() {
  showSection('merchant-dashboard-section');
  state.categories = await getBusinessCategories();
  renderBusinessCategoryOptions();
  await hydrateBusinesses();
}

function mountEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', clearSessionAndGoAuth);
  document.getElementById('open-merchant-form-btn')?.addEventListener('click', () => {
    hideSection('merchant-cta-section');
    showSection('merchant-form-section');
  });

  document.getElementById('business-cancel-btn')?.addEventListener('click', resetBusinessForm);

  const merchantForm = document.getElementById('merchant-profile-form');
  const idImageInput = document.getElementById('merchant-id-image');
  const idPreview = document.getElementById('merchant-id-preview');

  idImageInput?.addEventListener('change', () => {
    const file = idImageInput.files?.[0];
    if (!file) {
      if (idPreview) {
        idPreview.hidden = true;
        idPreview.removeAttribute('src');
      }
      return;
    }

    if (idPreview) {
      idPreview.src = URL.createObjectURL(file);
      idPreview.hidden = false;
    }
  });

  merchantForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const idFile = idImageInput?.files?.[0];
    if (!idFile) {
      alert('Sube una foto de identificación antes de enviar.');
      return;
    }

    if (idFile.size > MAX_IDENTIFICATION_IMAGE_BYTES) {
      alert('La imagen de identificación no debe superar 10MB.');
      return;
    }

    const payload = {
      curp: document.getElementById('merchant-curp')?.value.trim(),
      phone: normalizeDigits(document.getElementById('merchant-phone')?.value.trim()),
      storeName: document.getElementById('merchant-store-name')?.value.trim()
    };

    setButtonLoading('merchant-submit-btn', true, 'Enviar solicitud', 'Enviando...');
    try {
      validateMerchantForm(payload);
      const profile = await createMerchantProfile(payload, idFile);
      hideSection('merchant-cta-section');
      hideSection('merchant-form-section');
      setStatus(`Solicitud enviada. Estado actual: ${profile.status}.`);
      merchantForm.reset();
      if (idPreview) {
        idPreview.hidden = true;
        idPreview.removeAttribute('src');
      }
    } catch (error) {
      if (error.message === 'SESSION_INVALID') {
        alert('Tu sesión ya no es válida. Inicia sesión de nuevo.');
        clearSessionAndGoAuth();
        return;
      }
      alert(`No se pudo crear Merchant Profile: ${error.message}`);
    } finally {
      setButtonLoading('merchant-submit-btn', false, 'Enviar solicitud', 'Enviando...');
    }
  });

  document.getElementById('business-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setButtonLoading('business-submit-btn', true, state.editingBusinessId ? 'Actualizar negocio' : 'Guardar negocio', 'Guardando...');

    try {
      const payload = collectBusinessPayload();
      await saveBusiness(payload);
      resetBusinessForm();
      await hydrateBusinesses();
      alert('Negocio guardado correctamente.');
    } catch (error) {
      if (error.message === 'SESSION_INVALID') {
        clearSessionAndGoAuth();
        return;
      }
      alert(`No se pudo guardar el negocio: ${error.message}`);
    } finally {
      setButtonLoading('business-submit-btn', false, state.editingBusinessId ? 'Actualizar negocio' : 'Guardar negocio', 'Guardando...');
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const businessId = Number(event.target.closest('[data-business-id]')?.dataset.businessId || event.target.dataset.businessId || 0);
    const productId = Number(event.target.dataset.productId || 0);
    const business = state.businesses.find((item) => item.id === businessId);
    if (!action || !business) return;

    try {
      if (action === 'edit-business') {
        fillBusinessForm(business);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (action === 'delete-business') {
        if (!confirm('¿Seguro que quieres eliminar este negocio?')) return;
        await deleteBusiness(businessId);
        await hydrateBusinesses();
      }

      if (action === 'edit-product') {
        const product = (business.products || []).find((item) => item.id === productId);
        const card = event.target.closest('[data-business-id]');
        const form = card?.querySelector('.product-form');
        if (!product || !form) return;
        form.dataset.productId = String(product.id);
        form.querySelector('.product-name').value = product.name || '';
        form.querySelector('.product-description').value = product.description || '';
        form.querySelector('.product-price').value = product.price ?? '';
        form.querySelector('.product-photos').value = Array.isArray(product.photosUrl) ? product.photosUrl.join('\n') : '';
        form.querySelector('.product-cancel-btn').hidden = false;
        form.querySelector('button[type="submit"]').textContent = 'Actualizar producto';
      }

      if (action === 'delete-product') {
        if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
        await deleteProduct(productId);
        await hydrateBusinesses();
      }
    } catch (error) {
      alert(`No se pudo completar la acción: ${error.message}`);
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.product-form');
    if (!form) return;

    event.preventDefault();
    const businessId = Number(form.dataset.businessId || 0);
    const productId = Number(form.dataset.productId || 0) || null;
    const submitBtn = form.querySelector('button[type="submit"]');
    const cancelBtn = form.querySelector('.product-cancel-btn');

    submitBtn.disabled = true;
    submitBtn.textContent = productId ? 'Actualizando...' : 'Guardando...';

    try {
      const payload = {
        businessId,
        name: form.querySelector('.product-name').value.trim(),
        description: form.querySelector('.product-description').value.trim(),
        price: Number(form.querySelector('.product-price').value),
        photosUrl: form.querySelector('.product-photos').value
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean)
      };

      if (!payload.name || !payload.description || !Number.isFinite(payload.price)) {
        throw new Error('Completa los datos del producto antes de guardar.');
      }

      await saveProduct(payload, productId);
      form.reset();
      form.dataset.productId = '';
      cancelBtn.hidden = true;
      submitBtn.textContent = 'Guardar producto';
      await hydrateBusinesses();
    } catch (error) {
      alert(`No se pudo guardar el producto: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = form.dataset.productId ? 'Actualizar producto' : 'Guardar producto';
    }
  });

  document.getElementById('merchant-businesses-list')?.addEventListener('click', (event) => {
    const cancelBtn = event.target.closest('.product-cancel-btn');
    if (!cancelBtn) return;

    const form = cancelBtn.closest('.product-form');
    form.reset();
    form.dataset.productId = '';
    cancelBtn.hidden = true;
    form.querySelector('button[type="submit"]').textContent = 'Guardar producto';
  });
}

async function initProfilePage() {
  if (!getToken()) {
    window.location.href = 'auth.html';
    return;
  }

  mountEvents();

  try {
    const user = await getCurrentUser();
    state.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    setUserUi(user);

    if (user.roleName === 'ROLE_ADMIN') {
      window.location.replace('admin.html');
      return;
    }

    if (user.roleName === 'ROLE_MERCHANT') {
      hideSection('merchant-cta-section');
      hideSection('merchant-form-section');
      setStatus('Tu cuenta ya es Merchant y puedes publicar negocios.');
      await loadMerchantDashboard();
      return;
    }

    const merchantProfile = await getMerchantProfileByUserId(user.id);
    if (merchantProfile) {
      hideSection('merchant-cta-section');
      hideSection('merchant-form-section');
      setStatus(`Ya tienes solicitud de Merchant. Estado: ${merchantProfile.status}.`);
      if (merchantProfile.hasIdentificationImage) {
        await loadMerchantImage(user.id);
      }
      return;
    }

    showSection('merchant-cta-section');
  } catch (error) {
    console.error('[SelloDoradoMX] Error en perfil', error);
    if (error.message === 'SESSION_INVALID') {
      clearSessionAndGoAuth();
      return;
    }
    alert('No se pudo cargar tu perfil. Intenta de nuevo.');
  }
}

initProfilePage();