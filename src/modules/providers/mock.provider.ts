import { SmsProvider, SmsProviderSendInput, SmsProviderSendResult } from './smsProvider';
import crypto from 'crypto';

export class MockSmsProvider implements SmsProvider {
  async sendSms(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
    return {
      success: true,
      provider: 'MOCK',
      providerUid: `mock_${crypto.randomBytes(8).toString('hex')}`,
      providerStatus: 'Delivered',
      cost: '0',
      smsCount: 1,
      rawStatusCode: 200,
      rawResponseRedacted: { message: 'Mock sent' },
    };
  }
}
