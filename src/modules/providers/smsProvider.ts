export interface SmsProviderSendInput {
  recipient: string;
  senderId: string;
  type: 'plain';
  message: string;
  scheduleTime?: string;
  dltTemplateId?: string;
  correlationId: string;
}

export interface SmsProviderSendResult {
  success: boolean;
  provider: 'TEXTLK' | 'MOCK';
  providerUid?: string;
  providerStatus?: string;
  cost?: string;
  smsCount?: number;
  rawStatusCode?: number;
  rawResponseRedacted?: unknown;
  errorType?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface SmsProvider {
  sendSms(input: SmsProviderSendInput): Promise<SmsProviderSendResult>;
}
