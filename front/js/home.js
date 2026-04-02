import { businesses } from "./data.js";

const topContainer = document.getElementById("top-list");
const cultureContainer = document.getElementById("culture-list");
const searchInput = document.getElementById("search");

function renderTop(data) {
  topContainer.innerHTML = data.map(b => `
    <div class="min-w-[160px] bg-white rounded-2xl shadow overflow-hidden cursor-pointer"
         onclick="goDetail(${b.id})">

      <div class="relative">

        <img src="${b.image}" class="h-32 w-full object-cover"/>

        ${b.verified ? `
          <span class="absolute bottom-2 right-2 bg-yellow-400 text-xs px-2 py-1 rounded-full">
            ✔
          </span>
        ` : ""}

      </div>

      <div class="p-2">
        <h3 class="text-sm font-semibold">${b.name}</h3>
        <p class="text-xs text-gray-500">${b.category}</p>
      </div>

    </div>
  `).join("");
}

function renderCulture(data) {
  cultureContainer.innerHTML = data.map(b => `
    <div class="bg-white rounded-2xl shadow overflow-hidden cursor-pointer"
         onclick="goDetail(${b.id})">

      <div class="relative">

        <img src="${b.image}" class="h-36 w-full object-cover"/>

        <span class="absolute top-2 right-2 text-white text-lg">♡</span>

      </div>

      <div class="p-2">
        <h3 class="text-sm font-semibold">${b.name}</h3>
        <p class="text-xs text-gray-500">${b.category}</p>
      </div>

    </div>
  `).join("");
}

// 🔍 FILTRO
function filterData() {
  const text = searchInput.value.toLowerCase();

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(text) ||
    b.category.toLowerCase().includes(text)
  );

  renderTop(filtered.filter(b => b.verified));
  renderCulture(filtered);
}

// navegación
window.goDetail = function(id) {
  localStorage.setItem("businessId", id);
  window.location.href = "detail.html";
};

searchInput.addEventListener("input", filterData);

// inicial
renderTop(businesses.filter(b => b.verified));
renderCulture(businesses);