const API_BASE_URL = "http://localhost:8080/api/v1";

function getToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

function getTokenType() {
  return localStorage.getItem("tokenType") || "Bearer";
}

function getAuthHeaders() {
  const token = getToken();
  return {
    Authorization: `${getTokenType()} ${token}`
  };
}

function getJsonAuthHeaders() {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json"
  };
}

function clearSessionAndGoAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("tokenType");
  localStorage.removeItem("currentUser");
  window.location.href = "auth.html";
}

function roleToLabel(roleName) {
  if (roleName === "ROLE_MERCHANT") return "Merchant";
  if (roleName === "ROLE_ADMIN") return "Admin";
  return "Tourist";
}

function setUserUi(user) {
  const fullName = `${user?.name || ""} ${user?.lastname || ""}`.trim() || "Usuario";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

  const nameEl = document.getElementById("profile-name");
  const roleEl = document.getElementById("profile-role");
  const avatarEl = document.getElementById("profile-avatar");

  if (nameEl) nameEl.textContent = fullName;
  if (roleEl) roleEl.textContent = roleToLabel(user?.roleName);
  if (avatarEl) avatarEl.textContent = initials;
}

function setStatus(message) {
  const section = document.getElementById("merchant-status-section");
  const text = document.getElementById("merchant-status-message");
  if (!section || !text) return;
  text.textContent = message;
  section.hidden = false;
}

function showMerchantCta() {
  const cta = document.getElementById("merchant-cta-section");
  if (cta) cta.hidden = false;
}

function hideMerchantCta() {
  const cta = document.getElementById("merchant-cta-section");
  if (cta) cta.hidden = true;
}

function showMerchantForm() {
  const formSection = document.getElementById("merchant-form-section");
  if (formSection) formSection.hidden = false;
}

function hideMerchantForm() {
  const formSection = document.getElementById("merchant-form-section");
  if (formSection) formSection.hidden = true;
}

async function getCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    headers: getAuthHeaders()
  });

  if (response.status === 401 || response.status === 403) {
    setStatus("Tu sesión expiró o no es válida. Inicia sesión de nuevo.");
    return null;
  }

  if (!response.ok) {
    throw new Error(`No se pudo cargar el usuario: HTTP ${response.status}`);
  }

  return response.json();
}

async function getMerchantProfileByUserId(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/merchant-profile`, {
    method: "GET",
    headers: getAuthHeaders()
  });

  if (response.status === 404) return null;

  // Esta llamada no debe cerrar sesión del usuario; solo /users/me valida sesión.
  if (response.status === 401 || response.status === 403) return null;

  if (!response.ok) {
    throw new Error(`No se pudo cargar Merchant Profile: HTTP ${response.status}`);
  }

  return response.json();
}

function validateMerchantForm(data) {
  if (!data.curp || !data.phone || !data.storeName) {
    throw new Error("Completa todos los campos del Merchant Profile");
  }

  if (!/^\d{10}$/.test(data.phone)) {
    throw new Error("El teléfono debe tener 10 dígitos");
  }
}

async function createMerchantProfile(payload, identificationImage) {
  const formData = new FormData();
  formData.append("curp", payload.curp);
  formData.append("phone", payload.phone);
  formData.append("storeName", payload.storeName);
  formData.append("identificationImage", identificationImage);

  const response = await fetch(`${API_BASE_URL}/users/merchant-profiles`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeaders().Authorization
    },
    body: formData
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_INVALID");
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch {
      // Keep fallback HTTP message
    }
    throw new Error(message);
  }

  return response.json();
}

async function loadMerchantImage(userId) {
  const imageEl = document.getElementById("merchant-saved-image");
  if (!imageEl) return;

  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/merchant-profile/image`, {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (!response.ok) return;
    const blob = await response.blob();
    imageEl.src = URL.createObjectURL(blob);
    imageEl.hidden = false;
  } catch {
    // Si no se puede cargar la imagen, mantenemos la UI sin romper.
  }
}

function mountEvents() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", clearSessionAndGoAuth);
  }

  const openFormBtn = document.getElementById("open-merchant-form-btn");
  if (openFormBtn) {
    openFormBtn.addEventListener("click", showMerchantForm);
  }

  const form = document.getElementById("merchant-profile-form");
  const idImageInput = document.getElementById("merchant-id-image");
  const idPreview = document.getElementById("merchant-id-preview");

  if (idImageInput && idPreview) {
    idImageInput.addEventListener("change", () => {
      const file = idImageInput.files?.[0];
      if (!file) {
        idPreview.hidden = true;
        idPreview.removeAttribute("src");
        return;
      }

      idPreview.src = URL.createObjectURL(file);
      idPreview.hidden = false;
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const idFile = idImageInput?.files?.[0];
      if (!idFile) {
        alert("Sube una foto de identificación antes de enviar.");
        return;
      }

      // 5MB límite para evitar payload excesivo en JSON.
      if (idFile.size > 5 * 1024 * 1024) {
        alert("La imagen de identificación no debe superar 5MB.");
        return;
      }

      const payload = {
        curp: document.getElementById("merchant-curp")?.value.trim(),
        phone: document.getElementById("merchant-phone")?.value.trim(),
        storeName: document.getElementById("merchant-store-name")?.value.trim()
      };

      try {
        validateMerchantForm(payload);
        const profile = await createMerchantProfile(payload, idFile);
        hideMerchantCta();
        hideMerchantForm();
        setStatus(`Solicitud enviada. Estado actual: ${profile.status}.`);
        event.target.reset();
        if (idPreview) {
          idPreview.hidden = true;
          idPreview.removeAttribute("src");
        }
      } catch (error) {
        if (error.message === "SESSION_INVALID") {
          alert("Tu sesión ya no es válida. Inicia sesión de nuevo.");
          clearSessionAndGoAuth();
          return;
        }
        alert(`No se pudo crear Merchant Profile: ${error.message}`);
      }
    });
  }
}

async function initProfilePage() {
  const token = getToken();
  if (!token) {
    window.location.href = "auth.html";
    return;
  }

  mountEvents();

  try {
    const user = await getCurrentUser();
    if (!user) {
      hideMerchantCta();
      return;
    }

    localStorage.setItem("currentUser", JSON.stringify(user));
    setUserUi(user);

    const roleName = user.roleName;
    if (roleName === "ROLE_MERCHANT" || roleName === "ROLE_ADMIN") {
      hideMerchantCta();
      setStatus(roleName === "ROLE_MERCHANT"
        ? "Tu cuenta ya es Merchant."
        : "Tu cuenta es Admin.");
      return;
    }

    const merchantProfile = await getMerchantProfileByUserId(user.id);
    if (merchantProfile) {
      hideMerchantCta();
      hideMerchantForm();
      setStatus(`Ya tienes solicitud de Merchant. Estado: ${merchantProfile.status}.`);
      if (merchantProfile.hasIdentificationImage) {
        loadMerchantImage(user.id);
      }
      return;
    }

    showMerchantCta();
  } catch (error) {
    console.error("[SelloDoradoMX] Error en perfil", error);
    alert("No se pudo cargar tu perfil. Intenta de nuevo.");
  }
}

initProfilePage();