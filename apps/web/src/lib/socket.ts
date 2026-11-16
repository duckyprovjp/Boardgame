import { io, Socket } from 'socket.io-client';

function getSocketUrl(): string {
  const url = (
    process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL
  )?.trim();
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  throw new Error('NEXT_PUBLIC_SOCKET_URL is not configured');
}

export function createSocket(socketToken?: string | null): Socket {
  return io(getSocketUrl(), {
    withCredentials: true,
    transports: ['polling', 'websocket'],
    autoConnect: true,
    auth: socketToken ? { token: socketToken } : undefined,
  });
}
