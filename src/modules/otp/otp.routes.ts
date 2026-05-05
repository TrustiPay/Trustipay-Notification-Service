import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OtpService } from './otp.service';

export function createOtpRoutes(otpService: OtpService) {
  return async function otpRoutes(app: FastifyInstance) {
    app.post('/internal/v1/otp/send', async (request, reply) => {
      const schema = z.object({
        phone: z.string(),
        purpose: z.enum(['LOGIN', 'PHONE_VERIFICATION', 'PAYMENT_APPROVAL']),
        amount: z.string().optional(),
        userId: z.string().optional(),
        deviceId: z.string().optional(),
        idempotencyKey: z.string().optional(),
        correlationId: z.string().optional(),
      });

      try {
        const input = schema.parse(request.body);
        const result = await otpService.send(input);
        return reply.status(202).send(result);
      } catch (e: any) {
        return reply.status(400).send({ error: e.message });
      }
    });

    app.post('/internal/v1/otp/verify', async (request, reply) => {
      const schema = z.object({
        challengeId: z.string(),
        code: z.string(),
      });

      try {
        const input = schema.parse(request.body);
        const result = await otpService.verify(input);
        return reply.status(200).send(result);
      } catch (e: any) {
        const status = e.message === 'Challenge not found' ? 404 : 400;
        return reply.status(status).send({ error: e.message });
      }
    });

    app.post('/internal/v1/otp/resend', async (request, reply) => {
      const schema = z.object({
        challengeId: z.string(),
        phone: z.string(),
        correlationId: z.string().optional(),
      });

      try {
        const input = schema.parse(request.body);
        const result = await otpService.resend(input);
        return reply.status(202).send(result);
      } catch (e: any) {
        const status = e.message === 'Challenge not found' ? 404 : 400;
        return reply.status(status).send({ error: e.message });
      }
    });
  };
}
