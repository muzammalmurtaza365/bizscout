import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectMongo, disconnectMongo } from './db/connection';
import { initSocket } from './sockets/server';
import { startScheduler, stopScheduler, runOnce } from './services/scheduler';

async function bootstrap() {
  await connectMongo();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP + WebSocket server listening');
  });

  startScheduler();
  void runOnce();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopScheduler();
    server.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'failed to bootstrap');
  process.exit(1);
});
