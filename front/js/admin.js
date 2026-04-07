const API_BASE_URL = 'http://localhost:8080/api/v1';

const state = {
  currentUser: null,
  pendingMerchants: [],
  pendingBusinesses: []
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

function clearSessionAndGoAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('tokenType');
  localStorage.removeItem('currentUser');
  window.location.href = 'auth.html';
}

function roleToLabel(roleName) {
  if (roleName === 'ROLE_ADMIN') return 'Administrador';
  if (roleName === 'ROLE_MERCHANT') return 'Merchant';
  return 'Cuenta personal';
}

function humanizeCategory(name) {
  const value = String(name || '').toUpperCase();
  if (value === 'GASTRONOMY') return 'Gastronomia';
  if (value === 'STAYS') return 'Hospedaje';
  if (value === 'CULTURE') return 'Cultura';
  if (value === 'ADVENTURE') return 'Aventura';
  if (value === 'EXPERIENCES') return 'Experiencias';
  if (value === 'CRAFTS') return 'Artesanias';
  return name || 'Sin categoria';
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

function setAdminUserUi(user) {
  const fullName = `${user?.name || ''} ${user?.lastname || ''}`.trim() || 'Administrador';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'A';

  document.getElementById('admin-name').textContent = fullName;
  document.getElementById('admin-role').textContent = roleToLabel(user?.roleName);
  document.getElementById('admin-email').textContent = user?.email || 'Sin email registrado';
  document.getElementById('admin-avatar').textContent = initials;
}

function setSummaryCounts() {
  const merchants = state.pendingMerchants.length;
  const businesses = state.pendingBusinesses.length;

  document.getElementById('admin-merchant-count').textContent = String(merchants);
  document.getElementById('admin-business-count').textContent = String(businesses);
  document.getElementById('admin-merchant-chip').textContent = merchants === 1 ? '1 por revisar' : `${merchants} por revisar`;
  document.getElementById('admin-business-chip').textContent = businesses === 1 ? '1 por revisar' : `${businesses} por revisar`;
}

function renderAdminMerchants(list) {
  const container = document.getElementById('admin-merchants-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="admin-empty">No hay solicitudes merchant pendientes.</p>';
    return;
  }

  container.innerHTML = list.map((merchant) => {
    const applicantName = `${merchant.name || ''} ${merchant.lastname || ''}`.trim() || 'Sin nombre';
    const identificationLabel = merchant.hasIdentificationImage ? 'Archivo disponible' : 'Sin archivo';

    return `
      <article class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-kicker">Solicitud merchant</p>
            <h4 class="admin-card-name">${applicantName}</h4>
            <p class="admin-card-email">${merchant.email || 'Sin email'}</p>
          </div>
          <span class="detail-pill">${merchant.status || 'PENDING'}</span>
        </div>

        <div class="admin-metadata-grid">
          <div class="admin-meta-item">
            <span class="admin-meta-label">Negocio</span>
            <span class="admin-meta-value">${merchant.storeName || 'Sin nombre'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">CURP</span>
            <span class="admin-meta-value">${merchant.curp || 'Sin CURP'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Telefono</span>
            <span class="admin-meta-value">${merchant.phone || 'Sin telefono'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Identificacion</span>
            <span class="admin-meta-value">${identificationLabel}</span>
          </div>
        </div>

        <div class="profile-actions-row admin-card-actions">
          <button type="button" class="modal-btn-secondary" data-action="open-merchant-image" data-user-id="${merchant.userId}" ${merchant.hasIdentificationImage ? '' : 'disabled'}>Ver identificacion</button>
          <button type="button" class="btn-primary profile-main-btn" data-action="approve-merchant" data-merchant-profile-id="${merchant.id}">Aprobar merchant</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderAdminBusinesses(list) {
  const container = document.getElementById('admin-businesses-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="admin-empty">No hay negocios pendientes de validacion.</p>';
    return;
  }

  container.innerHTML = list.map((business) => {
    const hasCoordinates = Number.isFinite(Number(business.latitude)) && Number.isFinite(Number(business.longitude));
    const coordinates = hasCoordinates
      ? `${Number(business.latitude).toFixed(4)}, ${Number(business.longitude).toFixed(4)}`
      : 'Sin coordenadas';

    return `
      <article class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-kicker">Negocio pendiente</p>
            <h4 class="admin-card-name">${business.name || 'Negocio sin nombre'}</h4>
            <p class="admin-card-email">${humanizeCategory(business.categoryName)}</p>
          </div>
          <span class="detail-pill">Pendiente</span>
        </div>

        <div class="admin-metadata-grid">
          <div class="admin-meta-item">
            <span class="admin-meta-label">WhatsApp</span>
            <span class="admin-meta-value">${business.whatsappNumber || 'Sin numero'}</span>
          </div>
          <div class="admin-meta-item admin-meta-item--wide">
            <span class="admin-meta-label">Ubicacion</span>
            <span class="admin-meta-value">${coordinates}</span>
          </div>
        </div>

        <p class="profile-helper-text">${business.description || 'Sin descripcion cargada.'}</p>

        <div class="profile-actions-row admin-card-actions">
          <button type="button" class="btn-primary profile-main-btn" data-action="verify-business" data-business-id="${business.id}">Validar negocio</button>
        </div>
      </article>
    `;
  }).join('');
}

async function getCurrentUser() {
  return apiRequest('/users/me');
}

async function getPendingMerchantProfiles() {
  return apiRequest('/users/merchant-profiles?status=PENDING');
}

async function approveMerchantProfile(merchantProfileId) {
  return apiRequest(`/users/merchant-profiles/${merchantProfileId}/approve`, { method: 'PATCH' });
}

async function getPendingBusinesses() {
  return apiRequest('/businesses/pending');
}

async function verifyBusiness(businessId) {
  return apiRequest(`/businesses/${businessId}/verify`, { method: 'PATCH' });
}

async function openMerchantImage(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/merchant-profile/image`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (response.status === 401) {
    throw new Error('SESSION_INVALID');
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function setRefreshLoading(isLoading) {
  const refreshBtn = document.getElementById('admin-refresh-btn');
  if (!refreshBtn) return;
  refreshBtn.disabled = isLoading;
  refreshBtn.textContent = isLoading ? 'Actualizando...' : 'Actualizar';
}

async function loadAdminDashboard() {
  setRefreshLoading(true);
  try {
    const [merchantProfiles, pendingBusinesses] = await Promise.all([
      getPendingMerchantProfiles(),
      getPendingBusinesses()
    ]);

    state.pendingMerchants = merchantProfiles || [];
    state.pendingBusinesses = pendingBusinesses || [];

    renderAdminMerchants(state.pendingMerchants);
    renderAdminBusinesses(state.pendingBusinesses);
    setSummaryCounts();
  } finally {
    setRefreshLoading(false);
  }
}

function mountEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', clearSessionAndGoAuth);
  document.getElementById('admin-refresh-btn')?.addEventListener('click', async () => {
    try {
      await loadAdminDashboard();
    } catch (error) {
      if (error.message === 'SESSION_INVALID') {
        clearSessionAndGoAuth();
        return;
      }
      alert(`No se pudo actualizar el panel: ${error.message}`);
    }
  });

  document.body.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (!action) return;

    try {
      if (action === 'approve-merchant') {
        await approveMerchantProfile(Number(actionButton.dataset.merchantProfileId));
        await loadAdminDashboard();
        alert('Merchant aprobado correctamente.');
      }

      if (action === 'verify-business') {
        await verifyBusiness(Number(actionButton.dataset.businessId));
        await loadAdminDashboard();
        alert('Negocio validado correctamente.');
      }

      if (action === 'open-merchant-image') {
        await openMerchantImage(Number(actionButton.dataset.userId));
      }
    } catch (error) {
      if (error.message === 'SESSION_INVALID') {
        clearSessionAndGoAuth();
        return;
      }
      alert(`No se pudo completar la accion administrativa: ${error.message}`);
    }
  });
}

async function initAdminPage() {
  if (!getToken()) {
    window.location.href = 'auth.html';
    return;
  }

  mountEvents();

  try {
    const user = await getCurrentUser();
    if (user.roleName !== 'ROLE_ADMIN') {
      window.location.replace('profile.html');
      return;
    }

    state.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    setAdminUserUi(user);
    await loadAdminDashboard();
  } catch (error) {
    console.error('[SelloDoradoMX] Error en panel administrativo', error);
    if (error.message === 'SESSION_INVALID') {
      clearSessionAndGoAuth();
      return;
    }
    alert('No se pudo cargar el panel administrativo. Intenta de nuevo.');
  }
}

initAdminPage();