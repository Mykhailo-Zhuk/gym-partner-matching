/**
 * Minimal Socket.io client — receive-only (sending goes through REST per backend design).
 * Auto-reconnects on token refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/^http/, 'ws') ??
  'ws://localhost:3000';

export interface ChatMessagePayload {
  id: string;
  matchId: string;
  senderId: string | null;
  senderName: string | null;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM';
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

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
