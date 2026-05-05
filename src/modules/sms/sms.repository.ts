import { db } from '../../db/sqlite';

export interface SmsMessage {
  message_id: string;
  purpose: string;
  recipient_hash: string;
  recipient_masked: string;
  sender_id: string;
  template_key: string | null;
  template_version_id: string | null;
  rendered_message_hash: string;
  status: string;
  priority: string;
  provider: string;
  provider_uid: string | null;
  provider_status: string | null;
  provider_cost: string | null;
  provider_sms_count: number | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  failure_code: string | null;
  failure_message: string | null;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<SmsMessage, 'sent_at' | 'failed_at' | 'created_at' | 'updated_at'>;

export class SmsRepository {
  create(data: CreateInput): SmsMessage {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sms_messages (
        message_id, purpose, recipient_hash, recipient_masked, sender_id,
        template_key, template_version_id, rendered_message_hash,
        status, priority, provider, provider_uid, provider_status,
        provider_cost, provider_sms_count, correlation_id, idempotency_key,
        failure_code, failure_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.message_id, data.purpose, data.recipient_hash, data.recipient_masked,
      data.sender_id, data.template_key, data.template_version_id,
      data.rendered_message_hash, data.status, data.priority, data.provider,
      data.provider_uid, data.provider_status, data.provider_cost,
      data.provider_sms_count, data.correlation_id, data.idempotency_key,
      data.failure_code, data.failure_message, now, now
    );
    return this.findById(data.message_id)!;
  }

  updateAfterSend(messageId: string, result: {
    success: boolean;
    providerUid?: string;
    providerStatus?: string;
    cost?: string;
    smsCount?: number;
    errorType?: string;
    errorMessage?: string;
  }): void {
    const now = new Date().toISOString();
    if (result.success) {
      db.prepare(`
        UPDATE sms_messages
        SET status = 'SENT', provider_uid = ?, provider_status = ?,
            provider_cost = ?, provider_sms_count = ?, sent_at = ?, updated_at = ?
        WHERE message_id = ?
      `).run(result.providerUid ?? null, result.providerStatus ?? null,
             result.cost ?? null, result.smsCount ?? null, now, now, messageId);
    } else {
      db.prepare(`
        UPDATE sms_messages
        SET status = 'FAILED', failure_code = ?, failure_message = ?,
            failed_at = ?, updated_at = ?
        WHERE message_id = ?
      `).run(result.errorType ?? null, result.errorMessage ?? null, now, now, messageId);
    }
  }

  findById(messageId: string): SmsMessage | null {
    return db.prepare('SELECT * FROM sms_messages WHERE message_id = ?')
      .get(messageId) as SmsMessage | null;
  }

  findByIdempotencyKey(key: string): SmsMessage | null {
    return db.prepare('SELECT * FROM sms_messages WHERE idempotency_key = ?')
      .get(key) as SmsMessage | null;
  }
}

export const smsRepository = new SmsRepository();
