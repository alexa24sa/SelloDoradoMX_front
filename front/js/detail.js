const API_BASE_URL = "http://localhost:8080/api/v1";

const id = localStorage.getItem("businessId");
if (!id) window.location.href = "index.html";

function fillDetail(business) {
  const imgEl = document.getElementById("detail-image");
  const nameEl = document.getElementById("detail-name");
  const addrEl = document.getElementById("detail-address");
  const descEl = document.getElementById("detail-description");
  const badge = document.getElementById("detail-badge");
  const waEl = document.getElementById("detail-whatsapp");
  const mapsEl = document.getElementById("detail-maps-btn");

  const hasCoordinates = Number.isFinite(business.latitude) && Number.isFinite(business.longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${business.latitude},${business.longitude}`
    : "https://maps.google.com";

  if (imgEl) {
    const fallback = `https://picsum.photos/800/500?random=${Number(id) + 100}`;
    const firstPhoto = Array.isArray(business.photoUrls) && business.photoUrls.length ? business.photoUrls[0] : fallback;
    imgEl.src = firstPhoto;
  }

  if (nameEl) nameEl.textContent = business.name || "Negocio";

  if (addrEl) {
    addrEl.textContent = hasCoordinates
      ? `${business.latitude.toFixed(4)}, ${business.longitude.toFixed(4)}`
      : (business.categoryName || "Ubicación no disponible");
  }

  if (descEl) {
    descEl.textContent = business.description || "Este negocio aún no tiene descripción.";
  }

  if (badge) {
    if (business.verified) {
      badge.removeAttribute("hidden");
    } else {
      badge.setAttribute("hidden", "");
    }
  }

  if (waEl) {
    if (business.whatsappNumber) {
      waEl.href = `https://wa.me/${business.whatsappNumber}`;
    } else {
      waEl.href = "#";
      waEl.setAttribute("aria-disabled", "true");
      waEl.classList.add("is-disabled");
    }
  }

  if (mapsEl) mapsEl.href = mapsUrl;
}

async function loadBusinessDetail() {
  try {
    const res = await fetch(`${API_BASE_URL}/businesses/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const business = await res.json();
    fillDetail(business);
  } catch (error) {
    console.error("[SelloDoradoMX] No se pudo cargar el detalle del negocio", error);
    window.location.href = "index.html";
  }
}

loadBusinessDetail();
