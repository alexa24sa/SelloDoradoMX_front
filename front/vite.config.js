import { defineConfig } from 'vite';

export default defineConfig({
  // Esto permite que Vite busque index.html en la raíz
  root: './', 
  server: {
    port: 3000,
  }
});