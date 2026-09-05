import config from '@src/configs/app.config';

/**
 * The single source of truth for "can this server send WhatsApp at all?".
 *
 * WHATSAPP_PROVIDER=disabled is an operational OFF switch, not a
 * misconfiguration: the t2.micro host cannot afford the persistent Chrome the
 * `web` provider needs (~450MB — it exhausted RAM and hung the box), and the
 * official Cloud API is not set up yet. Every send path asks here FIRST, so
 * turning WhatsApp back on later is one env var, not a code change.
 *
 * Kept in its own module rather than inside whatsappWebClient.js on purpose:
 * importing that file pulls in whatsapp-web.js/puppeteer, which is exactly
 * the cost `disabled` exists to avoid.
 */
export const WHATSAPP_PROVIDER = Object.freeze({
  DISABLED: 'disabled',
  WEB: 'web',
  CLOUD_API: 'cloud_api',
});

export const getWhatsAppProvider = () => config.get('whatsapp.provider');

/** True when WHATSAPP_PROVIDER=disabled — nothing is sent, no browser is loaded. */
export const isWhatsAppDisabled = () => getWhatsAppProvider() === WHATSAPP_PROVIDER.DISABLED;
