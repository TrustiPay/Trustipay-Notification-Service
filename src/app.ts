import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from './config/env';
import { MockSmsProvider } from './modules/providers/mock.provider';
import { TextlkSmsProvider } from './modules/providers/textlk.provider';
import { SmsService } from './modules/sms/sms.service';
import { OtpService } from './modules/otp/otp.service';
import { createSmsRoutes } from './modules/sms/sms.routes';
import { createOtpRoutes } from './modules/otp/otp.routes';
import { templateRoutes } from './modules/templates/template.routes';

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

  const provider = env.SMS_PROVIDER_MODE === 'textlk' ? new TextlkSmsProvider() : new MockSmsProvider();
  const smsService = new SmsService(provider);
  const otpService = new OtpService(smsService);

  app.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ready', timestamp: new Date().toISOString() });
  });

  await app.register(templateRoutes);
  await app.register(createSmsRoutes(smsService));
  await app.register(createOtpRoutes(otpService));

  return app;
}
