function logout() {
  // Borra token o sesión
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Redirige al login
  window.location.href = "auth.html";
}