import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SmsService } from './sms.service';

const sendSchema = z.object({
  recipient: z.string(),
  templateKey: z.string(),
  locale: z.string().default('en'),
  variables: z.record(z.string(), z.any()).default({}),
  purpose: z.string(),
  correlationId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  priority: z.enum(['NORMAL', 'HIGH']).default('NORMAL'),
});

export function createSmsRoutes(smsService: SmsService) {
  return async function smsRoutes(app: FastifyInstance) {
    app.post('/internal/v1/sms/send', async (request, reply) => {
      try {
        const input = sendSchema.parse(request.body);
        const result = await smsService.send(input);
        return reply.status(202).send(result);
      } catch (e: any) {
        return reply.status(400).send({ error: e.message });
      }
    });
  };
}
