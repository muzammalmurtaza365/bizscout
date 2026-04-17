import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { socketConnectionsActive } from '../utils/metrics';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socketConnectionsActive.inc();
    logger.debug({ id: socket.id }, 'socket connected');
    socket.on('disconnect', (reason) => {
      socketConnectionsActive.dec();
      logger.debug({ id: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitResponse(event: 'response:new' | 'incident:new', payload: unknown): void {
  if (!io) return;
  io.emit(event, payload);
}

export function resetSocketForTests(): void {
  io = null;
}
