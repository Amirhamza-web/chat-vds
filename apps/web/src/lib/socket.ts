import { io, Socket } from 'socket.io-client';
import { apiBaseUrl } from './http';
import { useAuthStore } from './store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) return socket;
  const token = useAuthStore.getState().accessToken;
  socket = io(apiBaseUrl, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket(): void {
  disconnectSocket();
  getSocket();
}
