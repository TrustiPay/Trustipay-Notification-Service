import { db } from '../../db/sqlite';

export interface TemplateVersion {
  version_id: string;
  template_key: string;
  version_number: number;
  locale: string;
  body: string;
  variables_json: string;
  status: string;
}

export class TemplateRepository {
  getActiveVersion(templateKey: string, locale: string = 'en'): TemplateVersion | null {
    const row = db.prepare(`
      SELECT tv.* FROM notification_templates t
      JOIN notification_template_versions tv ON t.active_version_id = tv.version_id
      WHERE t.template_key = ? AND tv.locale = ? AND t.status = 'ACTIVE'
    `).get(templateKey, locale) as TemplateVersion | undefined;

    if (!row && locale !== 'en') {
      // Fallback to english
      return this.getActiveVersion(templateKey, 'en');
    }
    return row || null;
  }

  getVersion(versionId: string): TemplateVersion | null {
    const row = db.prepare('SELECT * FROM notification_template_versions WHERE version_id = ?').get(versionId) as TemplateVersion | undefined;
    return row || null;
  }
}

export const templateRepository = new TemplateRepository();
