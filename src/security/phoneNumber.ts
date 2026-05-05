export function normalizePhoneNumber(phone: string): string {
  // Remove spaces, hyphens, parentheses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  if (normalized.startsWith('+94')) {
    normalized = normalized.substring(1);
  }

  if (normalized.startsWith('0') && normalized.length === 10) {
    normalized = '94' + normalized.substring(1);
  }

  if (normalized.startsWith('7') && normalized.length === 9) {
    normalized = '94' + normalized;
  }

  if (!/^94[0-9]{9}$/.test(normalized)) {
    throw new Error('Invalid phone number format');
  }

  return normalized;
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length === 11 && phone.startsWith('94')) {
    return phone.substring(0, 4) + '****' + phone.substring(8);
  }
  return '****';
}
