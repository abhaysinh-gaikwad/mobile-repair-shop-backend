import config from '@src/configs/app.config';

/**
 * Normalize a saved customer mobile number into what WhatsApp's Cloud API
 * expects: digits only, with country code, no leading '+'.
 *
 * Customer numbers in this app are stored as plain 10-digit local numbers
 * (see customer.model.js) — no country code, sometimes with stray spaces or a
 * '+' if someone pasted it in. This is the one place that assumption is
 * encoded, so it doesn't get silently duplicated across senders.
 */
export function toWhatsAppNumber(rawMobile) {
  const digitsOnly = String(rawMobile ?? '').replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  const countryCode = config.get('whatsapp.defaultCountryCode');

  // Already has a country code (longer than a local number) — use as-is.
  if (digitsOnly.length > 10) return digitsOnly;

  return `${countryCode}${digitsOnly}`;
}
