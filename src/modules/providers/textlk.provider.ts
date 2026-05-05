import { env } from '../../config/env';
import { SmsProvider, SmsProviderSendInput, SmsProviderSendResult } from './smsProvider';

export class TextlkSmsProvider implements SmsProvider {
  async sendSms(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
    const url = `${env.TEXTLK_BASE_URL}${env.TEXTLK_SEND_SMS_PATH}`;

    const body = {
      api_key: env.TEXTLK_API_KEY,
      sender_id: input.senderId,
      to: input.recipient,
      message: input.message,
    };

    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= env.TEXTLK_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, env.TEXTLK_RETRY_BASE_MS * Math.pow(2, attempt - 1)));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.TEXTLK_TIMEOUT_MS);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);
        const raw = (await res.json()) as any;

        if (res.ok && raw.status === 'success') {
          return {
            success: true,
            provider: 'TEXTLK',
            providerUid: raw.data?.message_id ?? undefined,
            providerStatus: raw.data?.status ?? 'Queued',
            cost: String(raw.data?.cost ?? '0'),
            smsCount: raw.data?.sms_count ?? 1,
            rawStatusCode: res.status,
            rawResponseRedacted: { status: raw.status, message_id: raw.data?.message_id },
          };
        }

        return {
          success: false,
          provider: 'TEXTLK',
          rawStatusCode: res.status,
          rawResponseRedacted: { status: raw.status, message: raw.message },
          errorType: 'PROVIDER_ERROR',
          errorMessage: raw.message ?? 'Unknown provider error',
          retryable: res.status >= 500,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          lastErr = new Error('Request timed out');
          continue;
        }
        lastErr = err;
      }
    }

    return {
      success: false,
      provider: 'TEXTLK',
      errorType: lastErr?.message === 'Request timed out' ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: lastErr?.message ?? 'Network error',
      retryable: true,
    };
  }
}
