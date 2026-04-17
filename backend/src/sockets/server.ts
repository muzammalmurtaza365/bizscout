import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { socketConnectionsActive } from '../utils/metrics';
import { API_KEY_HEADER } from '../middleware/auth';

let io: SocketIOServer | null = null;

export interface InitSocketOptions {
  apiKey?: string;
}

export function initSocket(httpServer: HTTPServer, opts: InitSocketOptions = {}): SocketIOServer {
  const expectedKey = opts.apiKey ?? env.API_KEY;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', API_KEY_HEADER],
    },
  });

  if (expectedKey) {
    io.use((socket, next) => {
      const provided =
        (typeof socket.handshake.auth?.apiKey === 'string' && socket.handshake.auth.apiKey) ||
        (socket.handshake.headers[API_KEY_HEADER] as string | undefined);
      if (!provided) {
        return next(new Error('Missing API key'));
      }
      if (provided !== expectedKey) {
        logger.warn({ id: socket.id }, 'rejected socket: bad API key');
        return next(new Error('Invalid API key'));
      }
      next();
    });
  }

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
