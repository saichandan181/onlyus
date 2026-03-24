import { io, Socket } from 'socket.io-client';
import { API_URL, localTunnelHeaders } from '@/constants/theme';
import { attachSocketListeners } from '@/services/socketListeners';

let sharedSocket: Socket | null = null;
let sharedToken: string | null = null;

/**
 * One Socket.IO connection per auth token (shared by chat, settings, calendar).
 * Avoids duplicate connections and duplicate event handlers.
 */
export function getSharedSocket(token: string | null): Socket | null {
  if (!token) {
    disconnectSharedSocket();
    return null;
  }
  if (sharedSocket && sharedToken === token) {
    return sharedSocket;
  }
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  const tunnel = localTunnelHeaders();
  sharedSocket = io(API_URL, {
    query: { token },
    auth: { token },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    ...(Object.keys(tunnel).length > 0 && {
      extraHeaders: tunnel,
    }),
  });
  attachSocketListeners(sharedSocket);
  sharedToken = token;
  return sharedSocket;
}

export function disconnectSharedSocket(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
    sharedToken = null;
  }
}

export function getActiveSocket(): Socket | null {
  return sharedSocket;
}
