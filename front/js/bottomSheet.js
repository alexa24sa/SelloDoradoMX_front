document.addEventListener("DOMContentLoaded", () => {
  const sheet = document.querySelector('.bottom-sheet');
  const handle = document.querySelector('.drag-handle');

  let startY = 0;
  let currentTranslate = 60;
  let isDragging = false;

  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
  });

  handle.addEventListener('touchmove', (e) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    let newTranslate = currentTranslate + (diff / window.innerHeight) * 100;

    newTranslate = Math.max(0, Math.min(60, newTranslate));

    sheet.style.transform = `translate(-50%, ${newTranslate}%)`;
  });

  handle.addEventListener('touchend', (e) => {
    isDragging = false;

    const endY = e.changedTouches[0].clientY;
    const diff = endY - startY;

    if (diff < -50) {
      currentTranslate = 0; // abre
    } else if (diff > 50) {
      currentTranslate = 60; // cierra
    }

    sheet.style.transform = `translate(-50%, ${currentTranslate}%)`;
  });
});