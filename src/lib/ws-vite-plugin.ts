import type { Plugin } from 'vite';
import { getOrCreateWsHub } from './ws-hub';

export function secretSantaWebSocketPlugin(): Plugin {
  return {
    name: 'secretsanta-websocket',
    configureServer(server) {
      if (!server.httpServer) return;
      const hub = getOrCreateWsHub();

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url && req.url.startsWith('/ws/chat')) {
          hub.handleUpgrade(req, socket, head);
        }
      });
    },
    configurePreviewServer(server) {
      if (!server.httpServer) return;
      const hub = getOrCreateWsHub();

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url && req.url.startsWith('/ws/chat')) {
          hub.handleUpgrade(req, socket, head);
        }
      });
    },
  };
}
