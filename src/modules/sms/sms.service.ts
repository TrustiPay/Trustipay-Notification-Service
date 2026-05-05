import crypto from 'crypto';
import { env } from '../../config/env';
import { normalizePhoneNumber, maskPhoneNumber } from '../../security/phoneNumber';
import { templateRenderer } from '../templates/template.renderer';
import { SmsProvider } from '../providers/smsProvider';
import { smsRepository } from './sms.repository';

export interface SendSmsInput {
  recipient: string;
  templateKey: string;
  locale?: string;
  variables?: Record<string, any>;
  purpose: string;
  correlationId?: string;
  idempotencyKey?: string;
  priority?: 'NORMAL' | 'HIGH';
}

export class SmsService {
  constructor(private readonly provider: SmsProvider) {}

  async send(input: SendSmsInput) {
    if (input.idempotencyKey) {
      const existing = smsRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return {
          messageId: existing.message_id,
          status: existing.status,
          recipientMasked: existing.recipient_masked,
          idempotent: true,
        };
      }
    }

    const phone = normalizePhoneNumber(input.recipient);
    const recipientHash = crypto.createHmac('sha256', env.OTP_HASH_SECRET).update(phone).digest('hex');
    const recipientMasked = maskPhoneNumber(phone);

    const { renderedMessage, versionId } = templateRenderer.render(
      input.templateKey,
      input.locale ?? 'en',
      input.variables ?? {}
    );

    const renderedHash = crypto.createHash('sha256').update(renderedMessage).digest('hex');
    const messageId = `msg_${crypto.randomBytes(12).toString('hex')}`;
    const providerName = env.SMS_PROVIDER_MODE === 'textlk' ? 'TEXTLK' : 'MOCK';

    smsRepository.create({
      message_id: messageId,
      purpose: input.purpose,
      recipient_hash: recipientHash,
      recipient_masked: recipientMasked,
      sender_id: env.SMS_DEFAULT_SENDER_ID,
      template_key: input.templateKey,
      template_version_id: versionId,
      rendered_message_hash: renderedHash,
      status: 'PENDING',
      priority: input.priority ?? 'NORMAL',
      provider: providerName,
      provider_uid: null,
      provider_status: null,
      provider_cost: null,
      provider_sms_count: null,
      correlation_id: input.correlationId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      failure_code: null,
      failure_message: null,
    });

    const result = await this.provider.sendSms({
      recipient: phone,
      senderId: env.SMS_DEFAULT_SENDER_ID,
      type: 'plain',
      message: renderedMessage,
      correlationId: input.correlationId ?? messageId,
    });

    smsRepository.updateAfterSend(messageId, result);

    return {
      messageId,
      status: result.success ? 'SENT' : 'FAILED',
      recipientMasked,
      ...(result.success
        ? { providerUid: result.providerUid }
        : { errorType: result.errorType, errorMessage: result.errorMessage }),
    };
  }
}
