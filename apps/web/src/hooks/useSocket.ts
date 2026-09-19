/**
 * Socket.io client — copied from mobile/src/hooks/useSocket.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessagePayload } from '../types';

const SOCKET_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL?.replace(
    /^http/,
    'ws',
  ) ?? 'ws://localhost:3000';

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ChatMessagePayload | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (payload: ChatMessagePayload) => {
      setLastMessage(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  return { connected, lastMessage, socket: socketRef.current };
}
