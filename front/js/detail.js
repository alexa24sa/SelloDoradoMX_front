import { businesses } from "./data.js";

const id = localStorage.getItem("businessId");
const business = businesses.find(b => b.id == id);

if (!business) {
  // Negocio no encontrado — volver al inicio
  window.location.href = "index.html";
}

// Hero image
const imgEl = document.getElementById("detail-image");
if (imgEl && business.image) imgEl.src = business.image;

// Nombre
const nameEl = document.getElementById("detail-name");
if (nameEl) nameEl.textContent = business.name;

// Dirección (opcional en el mock, usa category como fallback)
const addrEl = document.getElementById("detail-address");
if (addrEl) addrEl.textContent = business.address || business.category;

// Descripción
const descEl = document.getElementById("detail-description");
if (descEl) descEl.textContent = business.description;

// Badge Sello Dorado
const badge = document.getElementById("detail-badge");
if (badge) {
  if (business.verified) {
    badge.removeAttribute("hidden");
  } else {
    badge.setAttribute("hidden", "");
  }
}

// WhatsApp
const waEl = document.getElementById("detail-whatsapp");
if (waEl && business.whatsapp) waEl.href = `https://wa.me/${business.whatsapp}`;

// Go! → Maps
const mapsEl = document.getElementById("detail-maps-btn");
if (mapsEl && business.maps) mapsEl.href = business.maps;
