import crypto from 'crypto';
import { env } from '../../config/env';
import { normalizePhoneNumber, maskPhoneNumber } from '../../security/phoneNumber';
import { SmsService } from '../sms/sms.service';
import { otpRepository } from './otp.repository';

const PURPOSE_TEMPLATE: Record<string, string> = {
  LOGIN: 'OTP_LOGIN',
  PHONE_VERIFICATION: 'OTP_PHONE_VERIFICATION',
  PAYMENT_APPROVAL: 'OTP_PAYMENT_APPROVAL',
};

function generateCode(): string {
  if (env.OTP_TEST_CODE && env.NODE_ENV !== 'production') return env.OTP_TEST_CODE;
  const max = Math.pow(10, env.OTP_LENGTH);
  return String(crypto.randomInt(0, max)).padStart(env.OTP_LENGTH, '0');
}

function hashCode(code: string): string {
  return crypto.createHmac('sha256', env.OTP_HASH_SECRET).update(code).digest('hex');
}

function hashPhone(phone: string): string {
  return crypto.createHmac('sha256', env.OTP_HASH_SECRET).update(phone).digest('hex');
}

export class OtpService {
  constructor(private readonly smsService: SmsService) {}

  async send(input: {
    phone: string;
    purpose: string;
    amount?: string;
    userId?: string;
    deviceId?: string;
    idempotencyKey?: string;
    correlationId?: string;
  }) {
    const templateKey = PURPOSE_TEMPLATE[input.purpose];
    if (!templateKey) {
      throw new Error(`Unknown OTP purpose: "${input.purpose}". Valid values: ${Object.keys(PURPOSE_TEMPLATE).join(', ')}`);
    }

    if (input.idempotencyKey) {
      const existing = otpRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return this.toSendResponse(existing, null);
    }

    const phone = normalizePhoneNumber(input.phone);
    const phoneHash = hashPhone(phone);
    const phoneMasked = maskPhoneNumber(phone);

    const code = generateCode();
    const challengeId = `otp_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000).toISOString();
    const nextResendAt = new Date(Date.now() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    const ttlMinutes = Math.ceil(env.OTP_TTL_SECONDS / 60);

    const variables: Record<string, any> = { code, ttlMinutes: String(ttlMinutes) };
    if (input.purpose === 'PAYMENT_APPROVAL') {
      if (!input.amount) throw new Error('amount is required for PAYMENT_APPROVAL OTP');
      variables.amount = input.amount;
    }

    const smsResult = await this.smsService.send({
      recipient: phone,
      templateKey,
      variables,
      purpose: `OTP_${input.purpose}`,
      correlationId: input.correlationId,
      priority: 'HIGH',
    });

    const challenge = otpRepository.create({
      challenge_id: challengeId,
      purpose: input.purpose,
      phone_hash: phoneHash,
      phone_masked: phoneMasked,
      user_id: input.userId ?? null,
      device_id: input.deviceId ?? null,
      otp_hash: hashCode(code),
      otp_hash_version: 1,
      status: 'PENDING',
      expires_at: expiresAt,
      verified_at: null,
      consumed_at: null,
      attempt_count: 0,
      max_attempts: env.OTP_MAX_ATTEMPTS,
      resend_count: 0,
      max_resends: env.OTP_MAX_RESENDS,
      next_resend_at: nextResendAt,
      last_sms_message_id: smsResult.messageId,
      idempotency_key: input.idempotencyKey ?? null,
    });

    const devCode = env.OTP_RETURN_CODE_IN_NON_PROD && env.NODE_ENV !== 'production' ? code : null;
    return this.toSendResponse(challenge, devCode);
  }

  async verify(input: { challengeId: string; code: string }) {
    const challenge = otpRepository.findById(input.challengeId);
    if (!challenge) throw new Error('Challenge not found');

    if (challenge.status === 'VERIFIED') return { success: true, alreadyVerified: true };
    if (challenge.status === 'LOCKED') throw new Error('Challenge is locked due to too many failed attempts');

    if (challenge.status !== 'EXPIRED' && new Date(challenge.expires_at) < new Date()) {
      otpRepository.markExpired(challenge.challenge_id);
      throw new Error('OTP has expired');
    }
    if (challenge.status === 'EXPIRED') throw new Error('OTP has expired');

    otpRepository.incrementAttempt(challenge.challenge_id);

    if (hashCode(input.code) !== challenge.otp_hash) {
      const updated = otpRepository.findById(challenge.challenge_id)!;
      if (updated.attempt_count >= updated.max_attempts) {
        otpRepository.markLocked(challenge.challenge_id);
        throw new Error('Too many failed attempts. Challenge is now locked');
      }
      return {
        success: false,
        attemptsRemaining: updated.max_attempts - updated.attempt_count,
      };
    }

    otpRepository.markVerified(challenge.challenge_id);
    return { success: true };
  }

  async resend(input: { challengeId: string; phone: string; correlationId?: string }) {
    const challenge = otpRepository.findById(input.challengeId);
    if (!challenge) throw new Error('Challenge not found');

    const phone = normalizePhoneNumber(input.phone);
    if (hashPhone(phone) !== challenge.phone_hash) throw new Error('Phone number does not match challenge');

    if (challenge.status === 'VERIFIED') throw new Error('Challenge already verified');
    if (challenge.status === 'LOCKED') throw new Error('Challenge is locked');
    if (challenge.status === 'EXPIRED' || new Date(challenge.expires_at) < new Date()) throw new Error('OTP has expired');
    if (challenge.resend_count >= challenge.max_resends) throw new Error('Maximum resend limit reached');

    if (challenge.next_resend_at && new Date(challenge.next_resend_at) > new Date()) {
      const waitSecs = Math.ceil((new Date(challenge.next_resend_at).getTime() - Date.now()) / 1000);
      throw new Error(`Resend cooldown active. Try again in ${waitSecs} seconds`);
    }

    const templateKey = PURPOSE_TEMPLATE[challenge.purpose];
    const code = generateCode();
    const ttlMinutes = Math.max(1, Math.ceil((new Date(challenge.expires_at).getTime() - Date.now()) / 60000));
    const variables: Record<string, any> = { code, ttlMinutes: String(ttlMinutes) };

    const smsResult = await this.smsService.send({
      recipient: phone,
      templateKey,
      variables,
      purpose: `OTP_${challenge.purpose}_RESEND`,
      correlationId: input.correlationId,
      priority: 'HIGH',
    });

    const nextResendAt = new Date(Date.now() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    otpRepository.updateForResend(challenge.challenge_id, hashCode(code), nextResendAt, smsResult.messageId);

    const devCode = env.OTP_RETURN_CODE_IN_NON_PROD && env.NODE_ENV !== 'production' ? code : null;

    return {
      challengeId: challenge.challenge_id,
      phoneMasked: challenge.phone_masked,
      resendsRemaining: challenge.max_resends - (challenge.resend_count + 1),
      expiresAt: challenge.expires_at,
      ...(devCode ? { devCode } : {}),
    };
  }

  private toSendResponse(challenge: ReturnType<typeof otpRepository.findById> & object, devCode: string | null) {
    return {
      challengeId: challenge.challenge_id,
      phoneMasked: challenge.phone_masked,
      expiresAt: challenge.expires_at,
      expiresInSeconds: Math.max(0, Math.floor((new Date(challenge.expires_at).getTime() - Date.now()) / 1000)),
      maxAttempts: challenge.max_attempts,
      ...(devCode ? { devCode } : {}),
    };
  }
}
