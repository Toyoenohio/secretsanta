import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { secretSantaWebSocketPlugin } from './src/lib/ws-vite-plugin';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  devToolbar: {
    enabled: false,
  },
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss(), secretSantaWebSocketPlugin()],
  },
});
