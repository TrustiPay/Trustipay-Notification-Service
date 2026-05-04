import { db } from './sqlite';
import crypto from 'crypto';

interface SeedTemplate {
  key: string;
  category: string;
  body: string;
  variables: string[];
}

const templates: SeedTemplate[] = [
  { key: 'TEST_SMS', category: 'ADMIN_TEST', body: 'Hi {{name}}, this is a TrustiPay test SMS.', variables: ['name'] },
  { key: 'OTP_LOGIN', category: 'OTP', body: 'Your TrustiPay login OTP is {{code}}. It expires in {{ttlMinutes}} minutes. Do not share it.', variables: ['code', 'ttlMinutes'] },
  { key: 'OTP_PHONE_VERIFICATION', category: 'OTP', body: 'Your TrustiPay phone verification code is {{code}}. It expires in {{ttlMinutes}} minutes.', variables: ['code', 'ttlMinutes'] },
  { key: 'OTP_PAYMENT_APPROVAL', category: 'OTP', body: 'Use OTP {{code}} to approve your TrustiPay payment of {{amount}}. Expires in {{ttlMinutes}} minutes.', variables: ['code', 'amount', 'ttlMinutes'] },
  { key: 'DEVICE_LINKED', category: 'SECURITY', body: 'A new device was linked to your TrustiPay account on {{date}}. If this was not you, contact support immediately.', variables: ['date'] },
  { key: 'PAYMENT_SETTLED', category: 'TRANSACTIONAL', body: 'TrustiPay payment of {{amount}} was settled. Transaction: {{transactionId}}.', variables: ['amount', 'transactionId'] },
  { key: 'PAYMENT_RECEIVED', category: 'TRANSACTIONAL', body: 'You received {{amount}} via TrustiPay. Transaction: {{transactionId}}.', variables: ['amount', 'transactionId'] },
  { key: 'OFFLINE_PAYMENT_PENDING_SYNC', category: 'TRANSACTIONAL', body: 'TrustiPay offline payment {{transactionId}} is accepted locally and pending server sync.', variables: ['transactionId'] },
  { key: 'OFFLINE_PAYMENT_REJECTED', category: 'TRANSACTIONAL', body: 'TrustiPay offline payment {{transactionId}} was rejected after sync. Reason: {{reason}}.', variables: ['transactionId', 'reason'] },
  { key: 'SECURITY_ALERT', category: 'SECURITY', body: 'TrustiPay security alert: {{message}}. If this was not you, contact support immediately.', variables: ['message'] }
];

export function runSeeds() {
  console.log('Seeding templates...');

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO notification_templates (template_key, category, default_locale, status, created_at, updated_at)
    VALUES (?, ?, 'en', 'ACTIVE', ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT OR IGNORE INTO notification_template_versions (version_id, template_key, version_number, locale, body, variables_json, checksum, status, created_at)
    VALUES (?, ?, 1, 'en', ?, ?, ?, 'ACTIVE', ?)
  `);

  const updateTemplateActiveVersion = db.prepare(`
    UPDATE notification_templates SET active_version_id = ? WHERE template_key = ?
  `);

  db.transaction(() => {
    const now = new Date().toISOString();
    for (const t of templates) {
      insertTemplate.run(t.key, t.category, now, now);

      const versionId = `tv_${crypto.randomBytes(8).toString('hex')}`;
      const variablesJson = JSON.stringify({ required: t.variables, optional: [], types: {} });
      const checksum = crypto.createHash('sha256').update(t.body).digest('hex');

      const res = insertVersion.run(versionId, t.key, t.body, variablesJson, checksum, now);
      
      if (res.changes > 0) {
        updateTemplateActiveVersion.run(versionId, t.key);
        console.log(`Seeded template: ${t.key}`);
      }
    }
  })();
  console.log('Seeding complete.');
}

if (require.main === module) {
  runSeeds();
}
