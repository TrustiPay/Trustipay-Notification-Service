import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from './config/env';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  });

  // Basic Health Endpoints
  app.get('/health/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    // We will add DB and Provider checks here later
    return reply.status(200).send({ status: 'ready', timestamp: new Date().toISOString() });
  });

  return app;
}
