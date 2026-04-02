// Lógica principal de inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización del frontend
});



const GOOGLE_CLIENT_ID = "146630611488-rtk4gcr4g7nqei3690tvk9218jhhpgi0.apps.googleusercontent.com";

window.onload = () => {
  // A. Inicializar el cliente de Google
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse, // Función que se ejecuta tras el login
    auto_select: false, // Si es true, loguea automáticamente si ya hay sesión
  });

  // B. Renderizar el botón oficial
  google.accounts.id.renderButton(document.getElementById("googleBtn"), {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
  });

  // C. (Opcional) Mostrar el "One Tap" (el banner flotante arriba a la derecha)
  google.accounts.id.prompt();
};


//Esta función recibe la respuesta de Google tras un login exitoso
async function handleCredentialResponse(response) {
    // El 'response.credential' es el JWT (ID Token) que se necesita
    const idToken = response.credential;
    console.log("Token generado por Google:", idToken);

    // D. Enviar el token al Backend de Spring Boot
    try {
        const backResponse = await fetch("http://localhost:8080/api/v1/users/auth/google", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: idToken
        });

        if (backResponse.ok) {
            const data = await backResponse.json();
            console.log("Login exitoso en el backend:", data);
            // Aquí se puede redirigir al usuario o se guarda el JWT propio
        } else {
            console.error("Error al validar el token en el servidor");
        }
    } catch (error) {
        console.error("Error de red conectando con Spring Boot:", error);
    }
}