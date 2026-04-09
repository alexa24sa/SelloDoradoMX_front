/**
 * Chat Widget para SelloDoradoMX
 * Burbuja flotante de chat con soporte para keywords y WhatsApp
 */

class ChatWidget {
  constructor(businessId) {
    this.businessId = businessId;
    this.isOpen = false;
    this.messages = [];
    this.containerElement = null;
    this.consecutiveMisunderstood = 0;
    this.apiBaseUrl = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || 'http://localhost:8088/api/v1';
    
    this.init();
  }

  /**
   * Inicializa el widget de chat
   */
  init() {
    // Crear contenedor del widget si no existe
    if (!document.getElementById('chat-widget-container')) {
      this.createWidgetDOM();
      this.attachEventListeners();
    } else {
      // Si ya existe, actualizar referencias
      this.containerElement = document.getElementById('chat-widget-container');
      this.attachEventListeners();
    }
  }

  /**
   * Crea la estructura DOM del widget
   */
  createWidgetDOM() {
    // Contenedor principal
    const container = document.createElement('div');
    container.id = 'chat-widget-container';
    container.className = 'chat-widget-container';
    container.innerHTML = `
      <!-- Burbuja flotante (chat bubble) -->
      <div id="chat-bubble" class="chat-bubble">
        <div class="bubble-content">
          <span class="bubble-icon">💬</span>
          <span class="bubble-text">¿Preguntas?</span>
        </div>
      </div>

      <!-- Ventana de chat -->
      <div id="chat-window" class="chat-window hidden">
        <!-- Header -->
        <div class="chat-header">
          <h3 class="chat-title">Atención al Cliente</h3>
          <button id="chat-close-btn" class="chat-close-btn" aria-label="Cerrar chat">✕</button>
        </div>

        <!-- Chat Messages Area -->
        <div id="chat-messages-area" class="chat-messages-area">
          <div class="chat-welcome-message">
            <p>👋 ¡Hola! ¿Cómo te puedo ayudar?</p>
            <small>Puedo responder sobre horario, nivel, ayuda y más.</small>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <input 
            type="text" 
            id="chat-input" 
            class="chat-input" 
            placeholder="Escribe tu pregunta..."
            autocomplete="off"
          >
          <button id="chat-send-btn" class="chat-send-btn" aria-label="Enviar">
            <span class="send-icon">➤</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.containerElement = container;
  }

  /**
   * Adjunta event listeners al widget
   */
  attachEventListeners() {
    const bubble = document.getElementById('chat-bubble');
    const closeBtn = document.getElementById('chat-close-btn');
    const sendBtn = document.getElementById('chat-send-btn');
    const inputField = document.getElementById('chat-input');

    // Toggle ventana de chat
    bubble.addEventListener('click', () => this.toggleChat());

    // Cerrar chat
    closeBtn.addEventListener('click', () => this.closeChat());

    // Enviar mensaje
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Enviar mensaje con Enter
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Focus en input al abrir
    const chatWindow = document.getElementById('chat-window');
    chatWindow.addEventListener('animationend', () => {
      if (this.isOpen) {
        inputField.focus();
      }
    });
  }

  /**
   * Toggle entre abrir y cerrar el chat
   */
  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  /**
   * Abre el chat
   */
  openChat() {
    const chatWindow = document.getElementById('chat-window');
    const bubble = document.getElementById('chat-bubble');
    
    this.isOpen = true;
    chatWindow.classList.remove('hidden');
    bubble.classList.add('active');
    
    // Focus en input
    setTimeout(() => {
      document.getElementById('chat-input').focus();
    }, 100);
  }

  /**
   * Cierra el chat
   */
  closeChat() {
    const chatWindow = document.getElementById('chat-window');
    const bubble = document.getElementById('chat-bubble');
    
    this.isOpen = false;
    chatWindow.classList.add('hidden');
    bubble.classList.remove('active');
  }

  /**
   * Envía un mensaje al backend
   */
  async sendMessage() {
    const inputField = document.getElementById('chat-input');
    const message = inputField.value.trim();
    const sendBtn = document.getElementById('chat-send-btn');

    if (!message) return;

    // Agregar mensaje del usuario a la UI
    this.addMessage(message, 'user');
    inputField.value = '';
    inputField.focus();

    // Deshabilitar botón de envío
    sendBtn.disabled = true;

    // Mostrar indicador de escritura
    this.showTypingIndicator();

    try {
      await Promise.resolve(window.AppRuntimeConfig?.ready).catch(() => null);
      this.apiBaseUrl = window.AppRuntimeConfig?.getApiBaseUrl?.() || window.API_BASE_URL || this.apiBaseUrl;

      // Enviar mensaje al backend
      const response = await fetch(`${this.apiBaseUrl}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: this.businessId,
          message: message,
        }),
        timeout: 10000, // Timeout de 10 segundos
      });

      if (!response.ok) {
        // Manejar diferentes códigos de error HTTP
        let errorMessage = '❌ Error al procesar tu mensaje. ';
        
        switch(response.status) {
          case 400:
            errorMessage += 'Datos inválidos. Por favor intenta de nuevo.';
            break;
          case 401:
            errorMessage += 'No autorizado. Por favor recarga la página.';
            break;
          case 403:
            errorMessage += 'Acceso denegado. Contacta al administrador.';
            break;
          case 404:
            errorMessage += 'Negocio no encontrado. Por favor recarga la página.';
            break;
          case 500:
            errorMessage += 'Error del servidor. Intenta de nuevo más tarde.';
            break;
          case 503:
            errorMessage += 'Servidor no disponible. Intenta de nuevo más tarde.';
            break;
          default:
            errorMessage += `Error HTTP ${response.status}. Por favor intenta de nuevo.`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Remover indicador de escritura
      this.removeTypingIndicator();

      // Actualizar contador de "no entendido"
      this.consecutiveMisunderstood = data.consecutiveMisunderstoodCount || 0;

      // Agregar respuesta del bot con pequeño delay para simular que está escribiendo
      setTimeout(() => {
        this.addMessage(data.botResponse, 'bot');

        // Si debe mostrar botón de WhatsApp
        if (data.shouldShowWhatsappButton && data.whatsappNumber) {
          setTimeout(() => {
            this.showWhatsappButton(data.whatsappNumber);
          }, 600);
        }
      }, 300);

    } catch (error) {
      console.error('Chat error:', error);
      this.removeTypingIndicator();
      
      let errorMsg = error.message;
      
      // Si no tiene un mensaje específico, usar default
      if (!errorMsg || errorMsg.includes('Error:')) {
        errorMsg = '⚠️ No pudimos conectar con el servidor. Comprueba tu conexión a internet e intenta de nuevo.';
      }
      
      this.addMessage(errorMsg, 'bot');
    } finally {
      // Re-habilitar botón de envío
      sendBtn.disabled = false;
      inputField.focus();
    }
  }

  /**
   * Agrega un mensaje al área de mensajes
   */
  addMessage(text, sender) {
    const messagesArea = document.getElementById('chat-messages-area');

    // Remover mensaje de bienvenida si existe
    const welcomeMsg = messagesArea.querySelector('.chat-welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = text;

    messageDiv.appendChild(messageContent);
    messagesArea.appendChild(messageDiv);

    // Scroll hacia el último mensaje
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  /**
   * Muestra indicador de que el bot está escribiendo
   */
  showTypingIndicator() {
    const messagesArea = document.getElementById('chat-messages-area');

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    typingContent.innerHTML = '<span></span><span></span><span></span>';

    typingDiv.appendChild(typingContent);
    messagesArea.appendChild(typingDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  /**
   * Remueve el indicador de escritura
   */
  removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Muestra el botón para hablar por WhatsApp
   */
  showWhatsappButton(whatsappNumber) {
    const messagesArea = document.getElementById('chat-messages-area');

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'chat-whatsapp-section';
    
    const button = document.createElement('a');
    button.href = `https://wa.me/${whatsappNumber}?text=Hola%2C%20me%20gustaría%20hablar%20con%20alguien%20del%20negocio`;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.className = 'chat-whatsapp-button';
    button.innerHTML = `
      <span class="whatsapp-icon">📱</span>
      <span class="whatsapp-text">Hablar con el local por WhatsApp</span>
    `;

    buttonDiv.appendChild(button);
    messagesArea.appendChild(buttonDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  /**
   * Limpia el chat (resetea mensajes)
   */
  clearChat() {
    this.messages = [];
    this.consecutiveMisunderstood = 0;
    const messagesArea = document.getElementById('chat-messages-area');
    messagesArea.innerHTML = `
      <div class="chat-welcome-message">
        <p>👋 ¡Hola! ¿Cómo te puedo ayudar?</p>
        <small>Puedo responder sobre horario, nivel, ayuda y más.</small>
      </div>
    `;
  }
}

/**
 * Inicializa el widget de chat globalmente
 * Se puede llamar desde cualquier página
 */
function initChatWidget(businessId) {
  if (!businessId) {
    console.warn('ChatWidget: businessId no proporcionado');
    return null;
  }

  // Verificar que API_BASE_URL esté disponible
  if (typeof _apiReady !== 'undefined') {
    _apiReady.then(() => {
      window.chatWidget = new ChatWidget(businessId);
    }).catch(err => {
      console.error('ChatWidget: Error esperando a la API', err);
      window.chatWidget = new ChatWidget(businessId);
    });
  } else {
    window.chatWidget = new ChatWidget(businessId);
  }

  return window.chatWidget;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChatWidget, initChatWidget };
}
