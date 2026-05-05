import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4210),
  SERVICE_NAME: z.string().default('trustipay-sms-notification-service'),
  
  DATABASE_URL: z.string().default('file:./data/trustipay_sms.sqlite'),
  SQLITE_BUSY_TIMEOUT_MS: z.coerce.number().default(5000),
  SQLITE_WAL_ENABLED: z.coerce.boolean().default(true),

  SMS_PROVIDER_MODE: z.enum(['mock', 'textlk']).default('mock'),
  SMS_LIVE_SENDING_ENABLED: z.coerce.boolean().default(false),
  SMS_DEFAULT_SENDER_ID: z.string().default('TrustiPay'),
  SMS_ALLOWED_TEST_RECIPIENTS: z.string().optional(),

  TEXTLK_BASE_URL: z.string().default('https://app.text.lk'),
  TEXTLK_SEND_SMS_PATH: z.string().default('/api/v3/sms/send'),
  TEXTLK_API_KEY: z.string().default('replace-me'),
  TEXTLK_TIMEOUT_MS: z.coerce.number().default(10000),
  TEXTLK_MAX_RETRIES: z.coerce.number().default(3),
  TEXTLK_RETRY_BASE_MS: z.coerce.number().default(1000),

  OTP_LENGTH: z.coerce.number().default(6),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_RESENDS: z.coerce.number().default(3),
  OTP_HASH_SECRET: z.string().default('replace-with-strong-random-secret'),
  OTP_TEST_CODE: z.string().optional(),
  OTP_RETURN_CODE_IN_NON_PROD: z.coerce.boolean().default(true),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PII_LOGGING_ENABLED: z.coerce.boolean().default(false)
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
