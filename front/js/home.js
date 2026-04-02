import { businesses } from "./data.js";

const container = document.getElementById("business-list");

function render(data) {
  container.innerHTML = data.map(b => `
    <div class="card cursor-pointer" onclick="goDetail(${b.id})">

      ${b.verified ? `
        <span class="bg-yellow-400 text-xs px-2 py-1 rounded-full">
          Sello Dorado
        </span>
      ` : ""}

      <img src="${b.image}" class="rounded-xl mb-2"/>

      <h3 class="font-semibold">${b.name}</h3>
      <p class="text-sm text-gray-500">${b.category}</p>

    </div>
  `).join("");
}

window.goDetail = function(id) {
  localStorage.setItem("businessId", id);
  window.location.href = "detail.html";
};

render(businesses);