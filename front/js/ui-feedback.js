(function initializeAppUi() {
  function hasSwal() {
    return typeof window.Swal !== 'undefined';
  }

  async function fire(options) {
    if (hasSwal()) {
      return window.Swal.fire({
        confirmButtonColor: '#6BB88A',
        cancelButtonColor: '#9AA5B1',
        reverseButtons: true,
        ...options
      });
    }

    if (options.showCancelButton) {
      return { isConfirmed: window.confirm(options.text || options.title || '¿Deseas continuar?') };
    }

    if (options.input) {
      const value = window.prompt(options.text || options.title || 'Escribe un valor', options.inputValue || '');
      return { isConfirmed: value !== null, value };
    }

    window.alert(options.text || options.title || 'Aviso');
    return { isConfirmed: true };
  }

  async function alert(options = {}) {
    return fire({
      icon: options.icon || 'info',
      title: options.title || 'Aviso',
      text: options.text || '',
      confirmButtonText: options.confirmButtonText || 'Entendido'
    });
  }

  async function success(options = {}) {
    return fire({
      icon: options.icon || 'success',
      title: options.title || 'Listo',
      text: options.text || '',
      confirmButtonText: options.confirmButtonText || 'Continuar'
    });
  }

  async function error(options = {}) {
    return fire({
      icon: options.icon || 'error',
      title: options.title || 'Ocurrió un problema',
      text: options.text || '',
      confirmButtonText: options.confirmButtonText || 'Cerrar'
    });
  }

  async function confirm(options = {}) {
    const result = await fire({
      icon: options.icon || 'warning',
      title: options.title || '¿Deseas continuar?',
      text: options.text || '',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || 'Sí, continuar',
      cancelButtonText: options.cancelButtonText || 'Cancelar'
    });

    return !!result.isConfirmed;
  }

  async function prompt(options = {}) {
    const result = await fire({
      title: options.title || 'Captura un valor',
      text: options.text || '',
      input: options.input || 'text',
      inputLabel: options.inputLabel,
      inputPlaceholder: options.placeholder || '',
      inputValue: options.inputValue || '',
      inputAttributes: options.inputAttributes || {},
      inputValidator: options.inputValidator,
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || 'Aceptar',
      cancelButtonText: options.cancelButtonText || 'Cancelar'
    });

    return result.isConfirmed ? result.value : null;
  }

  async function image(options = {}) {
    return fire({
      title: options.title || 'Documento',
      text: options.text || '',
      imageUrl: options.imageUrl,
      imageAlt: options.imageAlt || options.title || 'Documento',
      imageWidth: options.imageWidth || 820,
      width: options.width || 'min(92vw, 960px)',
      confirmButtonText: options.confirmButtonText || 'Cerrar'
    });
  }

  async function toast(options = {}) {
    if (hasSwal()) {
      return window.Swal.fire({
        toast: true,
        position: options.position || 'top-end',
        icon: options.icon || 'success',
        title: options.title || '',
        text: options.text || '',
        showConfirmButton: false,
        timer: options.timer || 2400,
        timerProgressBar: true
      });
    }

    return success(options);
  }

  window.AppUi = {
    alert,
    success,
    error,
    confirm,
    prompt,
    image,
    toast
  };
})();