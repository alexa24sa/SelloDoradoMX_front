let API_BASE_URL = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || 'http://localhost:8088/api/v1';
const _apiReady = Promise.resolve(window.AppRuntimeConfig?.ready)
  .catch(() => null)
  .then(() => {
    API_BASE_URL = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || API_BASE_URL;
  });
const DOCUMENT_TYPES = {
  IDENTIFICATION: 'IDENTIFICATION',
  ADDRESS_PROOF: 'ADDRESS_PROOF'
};
const ui = window.AppUi;

const state = {
  currentUser: null,
  pendingMerchants: [],
  approvedMerchants: [],
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
  if (roleName === 'ROLE_MERCHANT') return 'Cuenta de negocio';
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
  const approvedMerchants = state.approvedMerchants.length;
  const businesses = state.pendingBusinesses.length;

  document.getElementById('admin-merchant-count').textContent = String(merchants);
  document.getElementById('admin-active-merchant-count').textContent = String(approvedMerchants);
  document.getElementById('admin-business-count').textContent = String(businesses);
  document.getElementById('admin-merchant-chip').textContent = merchants === 1 ? '1 por revisar' : `${merchants} por revisar`;
  document.getElementById('admin-active-merchant-chip').textContent = approvedMerchants === 1 ? '1 activa' : `${approvedMerchants} activas`;
  document.getElementById('admin-business-chip').textContent = businesses === 1 ? '1 por revisar' : `${businesses} por revisar`;
}

function renderAdminMerchants(list) {
  const container = document.getElementById('admin-merchants-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="admin-empty">No hay solicitudes de registro pendientes.</p>';
    return;
  }

  container.innerHTML = list.map((merchant) => {
    const applicantName = `${merchant.name || ''} ${merchant.lastname || ''}`.trim() || 'Sin nombre';

    return `
      <article class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-kicker">Solicitud de registro</p>
            <h4 class="admin-card-name">${applicantName}</h4>
            <p class="admin-card-email">${merchant.email || 'Sin email'}</p>
          </div>
          <span class="detail-pill">${merchant.status || 'PENDING'}</span>
        </div>

        <div class="admin-metadata-grid">
          <div class="admin-meta-item">
            <span class="admin-meta-label">CURP</span>
            <span class="admin-meta-value">${merchant.curp || 'Sin CURP'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Teléfono</span>
            <span class="admin-meta-value">${merchant.phone || 'Sin teléfono'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Identificación</span>
            <span class="admin-meta-value">${merchant.hasIdentificationImage ? 'Disponible' : 'Sin archivo'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Comprobante</span>
            <span class="admin-meta-value">${merchant.hasAddressProofImage ? 'Disponible' : 'Sin archivo'}</span>
          </div>
        </div>

        <div class="profile-actions-row admin-card-actions">
          <button type="button" class="modal-btn-secondary" data-action="open-identification" data-user-id="${merchant.userId}" ${merchant.hasIdentificationImage ? '' : 'disabled'}>Ver identificación</button>
          <button type="button" class="modal-btn-secondary" data-action="open-address-proof" data-user-id="${merchant.userId}" ${merchant.hasAddressProofImage ? '' : 'disabled'}>Ver comprobante</button>
          <button type="button" class="btn-primary profile-main-btn" data-action="approve-request" data-merchant-profile-id="${merchant.id}">Aprobar solicitud</button>
          <button type="button" class="modal-btn-secondary" data-action="reject-request" data-merchant-profile-id="${merchant.id}">Rechazar</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderApprovedMerchants(list) {
  const container = document.getElementById('admin-active-merchants-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="admin-empty">No hay cuentas merchant activas registradas.</p>';
    return;
  }

  container.innerHTML = list.map((merchant) => {
    const applicantName = `${merchant.name || ''} ${merchant.lastname || ''}`.trim() || 'Sin nombre';

    return `
      <article class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-kicker">Cuenta merchant</p>
            <h4 class="admin-card-name">${applicantName}</h4>
            <p class="admin-card-email">${merchant.email || 'Sin email'}</p>
          </div>
          <span class="detail-pill">Activa</span>
        </div>

        <div class="admin-metadata-grid">
          <div class="admin-meta-item">
            <span class="admin-meta-label">CURP</span>
            <span class="admin-meta-value">${merchant.curp || 'Sin CURP'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Teléfono</span>
            <span class="admin-meta-value">${merchant.phone || 'Sin teléfono'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Identificación</span>
            <span class="admin-meta-value">${merchant.hasIdentificationImage ? 'Disponible' : 'Sin archivo'}</span>
          </div>
          <div class="admin-meta-item">
            <span class="admin-meta-label">Comprobante</span>
            <span class="admin-meta-value">${merchant.hasAddressProofImage ? 'Disponible' : 'Sin archivo'}</span>
          </div>
        </div>

        <div class="profile-actions-row admin-card-actions">
          <button type="button" class="modal-btn-secondary" data-action="open-identification" data-user-id="${merchant.userId}" ${merchant.hasIdentificationImage ? '' : 'disabled'}>Ver identificación</button>
          <button type="button" class="modal-btn-secondary" data-action="open-address-proof" data-user-id="${merchant.userId}" ${merchant.hasAddressProofImage ? '' : 'disabled'}>Ver comprobante</button>
          <button type="button" class="btn-danger" data-action="deactivate-merchant" data-merchant-profile-id="${merchant.id}">Desactivar cuenta</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderAdminBusinesses(list) {
  const container = document.getElementById('admin-businesses-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="admin-empty">No hay negocios pendientes de validación.</p>';
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
            <span class="admin-meta-value">${business.whatsappNumber || 'Sin número'}</span>
          </div>
          <div class="admin-meta-item admin-meta-item--wide">
            <span class="admin-meta-label">Ubicación</span>
            <span class="admin-meta-value">${coordinates}</span>
          </div>
        </div>

        <p class="profile-helper-text">${business.description || 'Sin descripción cargada.'}</p>

        <div class="profile-actions-row admin-card-actions">
          <button type="button" class="btn-primary profile-main-btn" data-action="verify-business" data-business-id="${business.id}">Validar negocio</button>
        </div>
      </article>
    `;
  }).join('');
}

function getCurrentUser() {
  return apiRequest('/users/me');
}

function getPendingMerchantProfiles() {
  return apiRequest('/users/merchant-profiles?status=PENDING');
}

function getApprovedMerchantProfiles() {
  return apiRequest('/users/merchant-profiles?status=APPROVED');
}

function approveMerchantProfile(merchantProfileId) {
  return apiRequest(`/users/merchant-profiles/${merchantProfileId}/approve`, { method: 'PATCH' });
}

function rejectMerchantProfile(merchantProfileId, reason) {
  return apiRequest(`/users/merchant-profiles/${merchantProfileId}/reject`, {
    method: 'PATCH',
    body: { reason }
  });
}

function getPendingBusinesses() {
  return apiRequest('/businesses/pending');
}

function verifyBusiness(businessId) {
  return apiRequest(`/businesses/${businessId}/verify`, { method: 'PATCH' });
}

async function openMerchantDocument(userId, documentType, title) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/merchant-profile/image?type=${encodeURIComponent(documentType)}`, {
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
  const imageUrl = URL.createObjectURL(blob);

  try {
    await ui.image({ title, imageUrl, imageAlt: title, confirmButtonText: 'Cerrar' });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function setRefreshLoading(isLoading) {
  const refreshBtn = document.getElementById('admin-refresh-btn');
  if (!refreshBtn) return;
  refreshBtn.disabled = isLoading;
  refreshBtn.textContent = isLoading ? 'Actualizando...' : 'Actualizar';
}

async function requestRejectionReason(options = {}) {
  return ui.prompt({
    title: options.title || 'Rechazar solicitud',
    text: options.text || 'Escribe el motivo que verá el usuario para corregir su información.',
    input: 'textarea',
    placeholder: options.placeholder || 'Ejemplo: La identificación no es legible y el comprobante de domicilio no coincide con los datos enviados.',
    confirmButtonText: options.confirmButtonText || 'Guardar rechazo',
    cancelButtonText: 'Cancelar',
    inputValidator: (value) => {
      const reason = String(value || '').trim();
      if (!reason) return 'Escribe un motivo de rechazo.';
      if (reason.length < 10) return 'Escribe un poco más de detalle para que el usuario pueda corregirlo.';
      return null;
    }
  });
}

async function loadAdminDashboard() {
  setRefreshLoading(true);
  try {
    const [merchantProfiles, approvedMerchants, pendingBusinesses] = await Promise.all([
      getPendingMerchantProfiles(),
      getApprovedMerchantProfiles(),
      getPendingBusinesses()
    ]);

    state.pendingMerchants = merchantProfiles || [];
    state.approvedMerchants = approvedMerchants || [];
    state.pendingBusinesses = pendingBusinesses || [];

    renderAdminMerchants(state.pendingMerchants);
    renderApprovedMerchants(state.approvedMerchants);
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
      await ui.toast({ title: 'Panel actualizado.' });
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionError();
        return;
      }
      await ui.error({ title: 'No se pudo actualizar el panel', text: error.message });
    }
  });

  document.body.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (!action) return;

    try {
      if (action === 'approve-request') {
        const confirmed = await ui.confirm({
          title: 'Aprobar solicitud',
          text: 'Esta cuenta quedará autorizada para publicar negocios.',
          confirmButtonText: 'Sí, aprobar',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmed) return;

        await approveMerchantProfile(Number(actionButton.dataset.merchantProfileId));
        await loadAdminDashboard();
        await ui.toast({ title: 'Solicitud aprobada correctamente.' });
      }

      if (action === 'reject-request') {
        const reason = await requestRejectionReason();
        if (!reason) return;

        await rejectMerchantProfile(Number(actionButton.dataset.merchantProfileId), reason.trim());
        await loadAdminDashboard();
        await ui.toast({ title: 'Solicitud rechazada correctamente.' });
      }

      if (action === 'deactivate-merchant') {
        const reason = await requestRejectionReason({
          title: 'Desactivar cuenta merchant',
          text: 'Escribe el motivo que verá el usuario para saber por qué su cuenta fue desactivada.',
          placeholder: 'Ejemplo: Se detectó información desactualizada en tu cuenta y necesitamos que vuelvas a enviar tu documentación.',
          confirmButtonText: 'Guardar motivo'
        });
        if (!reason) return;

        await rejectMerchantProfile(Number(actionButton.dataset.merchantProfileId), reason.trim());
        await loadAdminDashboard();
        await ui.toast({ title: 'Cuenta desactivada correctamente.' });
      }

      if (action === 'verify-business') {
        const confirmed = await ui.confirm({
          title: 'Validar negocio',
          text: 'El negocio quedará marcado como verificado.',
          confirmButtonText: 'Sí, validar',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmed) return;

        await verifyBusiness(Number(actionButton.dataset.businessId));
        await loadAdminDashboard();
        await ui.toast({ title: 'Negocio validado correctamente.' });
      }

      if (action === 'open-identification') {
        await openMerchantDocument(Number(actionButton.dataset.userId), DOCUMENT_TYPES.IDENTIFICATION, 'Identificación oficial');
      }

      if (action === 'open-address-proof') {
        await openMerchantDocument(Number(actionButton.dataset.userId), DOCUMENT_TYPES.ADDRESS_PROOF, 'Comprobante de domicilio');
      }
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionError();
        return;
      }
      await ui.error({ title: 'No se pudo completar la acción administrativa', text: error.message });
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
    if (isSessionError(error)) {
      await handleSessionError();
      return;
    }
    await ui.error({ title: 'No se pudo cargar el panel administrativo', text: 'Intenta de nuevo en unos momentos.' });
  }
}

_apiReady.then(() => initAdminPage());