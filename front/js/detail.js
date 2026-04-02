import { businesses } from "./data.js";

const id = localStorage.getItem("businessId");

const business = businesses.find(b => b.id == id);

document.getElementById("image").src = business.image;
document.getElementById("name").innerText = business.name;
document.getElementById("description").innerText = business.description;

document.getElementById("whatsapp").href =
  `https://wa.me/${business.whatsapp}`;

document.getElementById("maps").href = business.maps;

// Badge
const badge = document.getElementById("badge");

if (business.verified) {
  badge.innerText = "Sello Dorado";
  badge.className = "bg-yellow-400 text-black mt-2 px-3 py-1 text-xs rounded-full inline-block";
} else {
  badge.innerText = "No verificado";
  badge.className = "bg-gray-300 text-black mt-2 px-3 py-1 text-xs rounded-full inline-block";
}