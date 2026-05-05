import { db } from '../../db/sqlite';

export interface OtpChallenge {
  challenge_id: string;
  purpose: string;
  phone_hash: string;
  phone_masked: string;
  user_id: string | null;
  device_id: string | null;
  otp_hash: string;
  otp_hash_version: number;
  status: string;
  expires_at: string;
  verified_at: string | null;
  consumed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  resend_count: number;
  max_resends: number;
  next_resend_at: string | null;
  last_sms_message_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

type CreateInput = Omit<OtpChallenge, 'created_at' | 'updated_at'>;

export class OtpRepository {
  create(data: CreateInput): OtpChallenge {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO otp_challenges (
        challenge_id, purpose, phone_hash, phone_masked, user_id, device_id,
        otp_hash, otp_hash_version, status, expires_at, verified_at, consumed_at,
        attempt_count, max_attempts, resend_count, max_resends, next_resend_at,
        last_sms_message_id, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.challenge_id, data.purpose, data.phone_hash, data.phone_masked,
      data.user_id, data.device_id, data.otp_hash, data.otp_hash_version,
      data.status, data.expires_at, data.verified_at, data.consumed_at,
      data.attempt_count, data.max_attempts, data.resend_count, data.max_resends,
      data.next_resend_at, data.last_sms_message_id, data.idempotency_key, now, now
    );
    return this.findById(data.challenge_id)!;
  }

  findById(challengeId: string): OtpChallenge | null {
    return db.prepare('SELECT * FROM otp_challenges WHERE challenge_id = ?')
      .get(challengeId) as OtpChallenge | null;
  }

  findByIdempotencyKey(key: string): OtpChallenge | null {
    return db.prepare('SELECT * FROM otp_challenges WHERE idempotency_key = ?')
      .get(key) as OtpChallenge | null;
  }

  incrementAttempt(challengeId: string): void {
    db.prepare(`
      UPDATE otp_challenges SET attempt_count = attempt_count + 1, updated_at = ?
      WHERE challenge_id = ?
    `).run(new Date().toISOString(), challengeId);
  }

  markVerified(challengeId: string): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE otp_challenges SET status = 'VERIFIED', verified_at = ?, updated_at = ?
      WHERE challenge_id = ?
    `).run(now, now, challengeId);
  }

  markExpired(challengeId: string): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE otp_challenges SET status = 'EXPIRED', updated_at = ? WHERE challenge_id = ?
    `).run(now, challengeId);
  }

  markLocked(challengeId: string): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE otp_challenges SET status = 'LOCKED', updated_at = ? WHERE challenge_id = ?
    `).run(now, challengeId);
  }

  updateForResend(challengeId: string, newOtpHash: string, nextResendAt: string, lastSmsMessageId: string): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE otp_challenges
      SET otp_hash = ?, resend_count = resend_count + 1,
          next_resend_at = ?, last_sms_message_id = ?, updated_at = ?
      WHERE challenge_id = ?
    `).run(newOtpHash, nextResendAt, lastSmsMessageId, now, challengeId);
  }
}

export const otpRepository = new OtpRepository();
