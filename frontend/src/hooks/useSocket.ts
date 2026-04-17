import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ResponseRecord } from '../types/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

type Handlers = {
  onResponse?: (r: ResponseRecord) => void;
  onIncident?: (r: ResponseRecord) => void;
};

export function useSocket(handlers: Handlers) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('response:new', (r: ResponseRecord) => handlersRef.current.onResponse?.(r));
    socket.on('incident:new', (r: ResponseRecord) => handlersRef.current.onIncident?.(r));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { connected };
}
