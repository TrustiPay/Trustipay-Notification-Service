import Mustache from 'mustache';
import { TemplateVersion, templateRepository } from './template.repository';

export class TemplateRenderer {
  render(templateKey: string, locale: string, variables: Record<string, any>): { renderedMessage: string, versionId: string } {
    const version = templateRepository.getActiveVersion(templateKey, locale);
    if (!version) {
      throw new Error(`Template not found or inactive: ${templateKey} for locale: ${locale}`);
    }

    return this.renderVersion(version, variables);
  }

  renderVersion(version: TemplateVersion, variables: Record<string, any>): { renderedMessage: string, versionId: string } {
    const varsConfig = JSON.parse(version.variables_json);
    const requiredVars: string[] = varsConfig.required || [];

    // Validate missing variables
    for (const reqVar of requiredVars) {
      if (variables[reqVar] === undefined || variables[reqVar] === null) {
        throw new Error(`Missing required variable: ${reqVar}`);
      }
    }

    // Reject unknown variables
    const allowedVars = new Set([...requiredVars, ...(varsConfig.optional || [])]);
    for (const providedVar of Object.keys(variables)) {
      if (!allowedVars.has(providedVar)) {
        throw new Error(`Unknown variable provided: ${providedVar}`);
      }
    }

    // Render using Mustache
    const renderedMessage = Mustache.render(version.body, variables);

    return {
      renderedMessage,
      versionId: version.version_id,
    };
  }
}

export const templateRenderer = new TemplateRenderer();
