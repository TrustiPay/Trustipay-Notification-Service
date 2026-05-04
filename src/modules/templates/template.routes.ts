import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { templateRenderer } from './template.renderer';
import { templateRepository } from './template.repository';

export async function templateRoutes(app: FastifyInstance) {
  app.post('/internal/v1/templates/render-preview', async (request, reply) => {
    const schema = z.object({
      templateKey: z.string(),
      locale: z.string().default('en'),
      variables: z.record(z.string(), z.any()).default({}),
    });

    try {
      const input = schema.parse(request.body);
      const result = templateRenderer.render(input.templateKey, input.locale, input.variables);
      return reply.send({ status: 'success', ...result });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });
  
  // Note: Activation logic requires db.transaction and generating version.
  // Stubbing it for MVP based on plan (focus is on sending for MVP)
}
