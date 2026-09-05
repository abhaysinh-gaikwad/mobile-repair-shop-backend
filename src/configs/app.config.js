// NOTE: This file is CommonJS on purpose.
// sequelize-cli loads `database.config.js` (which requires this) OUTSIDE of
// Babel, so it must not use ESM `import`/`export` syntax.
const path = require('path');

const convict = require('convict');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve('src', '../.env') });

const config = convict({
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 4200,
    env: 'PORT',
  },
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'staging', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  logLevel: {
    doc: 'Level of logs to show.',
    format: String,
    default: 'debug',
    env: 'LOG_LEVEL',
  },
  app: {
    name: {
      doc: 'The application name.',
      format: String,
      default: 'mobile-repair-shop-backend',
      env: 'APP_NAME',
    },
    url: {
      doc: 'The application URL.',
      format: String,
      default: 'http://localhost:4200',
      env: 'APP_URL',
    },
    environmentTag: {
      doc: "Which of the frontend's two environments THIS backend serves — 'prod' or 'test'. The frontend keeps a separate login session per environment and routes /api through a proxy that picks the backend from an `mrs_env` cookie; the receipt-PDF renderer drives that same frontend with a headless browser, so it has to set that cookie (and the matching session key) to the environment it is itself part of. Without it the Test backend's PDF renderer would load the frontend with no cookie, be proxied to PROD, and render the wrong shop's receipt.",
      format: ['prod', 'test'],
      default: 'prod',
      env: 'MRS_ENV',
    },
  },
  cors: {
    origin: {
      doc: 'Allowed CORS origin(s), comma separated.',
      format: String,
      default: 'http://localhost:4000',
      env: 'CORS_ORIGIN',
    },
  },
  sequelize: {
    name: {
      doc: 'Database name.',
      format: String,
      default: 'mobile_repair_shop',
      env: 'DB_NAME',
    },
    user: {
      doc: 'Database user.',
      format: String,
      default: 'postgres',
      env: 'DB_USER',
    },
    password: {
      doc: 'Database password.',
      format: String,
      default: '',
      env: 'DB_PASSWORD',
      sensitive: true,
    },
    host: {
      doc: 'Database host.',
      format: String,
      default: 'localhost',
      env: 'DB_HOST',
    },
    port: {
      doc: 'Database port.',
      format: 'port',
      default: 5432,
      env: 'DB_PORT',
    },
  },
  jwt: {
    loginTokenSecret: {
      doc: 'Secret used to sign login JWTs.',
      format: String,
      default: 'change-this-secret',
      env: 'LOGIN_JWT_SECRET',
      sensitive: true,
    },
    loginTokenExpiry: {
      doc: 'Login JWT expiry.',
      format: String,
      default: '7d',
      env: 'LOGIN_JWT_EXPIRY',
    },
  },
  whatsapp: {
    provider: {
      doc: "Which transport sends WhatsApp messages. 'disabled' (the DEFAULT) sends nothing and, critically, never loads whatsapp-web.js/puppeteer or launches a Chrome — the only setting that costs zero RAM. 'web' drives a logged-in WhatsApp Web session via a persistent headless Chrome (~450MB resident: it exhausted the t2.micro and hung the box, which is why it is no longer the default — do not re-enable it without confirming the host has the headroom). 'cloud_api' uses Meta's official Cloud API (requires WHATSAPP_ACCESS_TOKEN etc, and an approved template) and needs no browser at all — this is the intended destination.",
      format: ['disabled', 'web', 'cloud_api'],
      default: 'disabled',
      env: 'WHATSAPP_PROVIDER',
    },
    accessToken: {
      doc: 'Meta WhatsApp Cloud API permanent/system-user access token.',
      format: String,
      default: '',
      env: 'WHATSAPP_ACCESS_TOKEN',
      sensitive: true,
    },
    phoneNumberId: {
      doc: 'The WhatsApp Business phone number ID messages are sent FROM (Meta Cloud API).',
      format: String,
      default: '',
      env: 'WHATSAPP_PHONE_NUMBER_ID',
    },
    businessAccountId: {
      doc: 'The WhatsApp Business Account (WABA) ID.',
      format: String,
      default: '',
      env: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
    },
    apiVersion: {
      doc: 'Graph API version used for all WhatsApp Cloud API calls, e.g. v21.0.',
      format: String,
      default: 'v21.0',
      env: 'WHATSAPP_API_VERSION',
    },
    receiptTemplateName: {
      doc: 'Name of the Meta-approved message template used for the repair-receipt notification.',
      format: String,
      default: 'repair_receipt',
      env: 'WHATSAPP_RECEIPT_TEMPLATE_NAME',
    },
    templateLanguage: {
      doc: 'Language code the template was approved under, e.g. en, en_US.',
      format: String,
      default: 'en',
      env: 'WHATSAPP_TEMPLATE_LANGUAGE',
    },
    appSecret: {
      doc: "Meta app secret. Used ONLY to verify the X-Hub-Signature-256 on incoming webhooks — proof a callback really came from Meta and not from anyone who guessed the URL. Never sent anywhere.",
      format: String,
      default: '',
      env: 'WHATSAPP_APP_SECRET',
      sensitive: true,
    },
    webhookVerifyToken: {
      doc: "A string you invent and paste into Meta's webhook setup form. Meta echoes it back on the one-time GET verification handshake; the value itself is arbitrary, it just has to match on both sides. Generate with `openssl rand -hex 32`.",
      format: String,
      default: '',
      env: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      sensitive: true,
    },
    defaultCountryCode: {
      doc: 'Prepended to a saved mobile number when it has no country code, e.g. 91 for India.',
      format: String,
      default: '91',
      env: 'WHATSAPP_DEFAULT_COUNTRY_CODE',
    },
  },
  frontend: {
    baseUrl: {
      doc: 'Where the Next.js app is reachable from THIS server. Used to render the receipt PDF (headless browser navigates to /repairs/:id/print) — never sent to a client.',
      format: String,
      default: 'http://localhost:5055',
      env: 'FRONTEND_URL',
    },
  },
  security: {
    deviceSecretKey: {
      doc: 'Key used to encrypt device unlock credentials at rest. Changing it makes existing credentials unreadable.',
      format: String,
      default: 'change-this-device-secret-key',
      env: 'DEVICE_SECRET_KEY',
      sensitive: true,
    },
  },
  owner: {
    name: {
      doc: 'Seeded owner account name.',
      format: String,
      default: 'Shop Owner',
      env: 'OWNER_NAME',
    },
    email: {
      doc: 'Seeded owner account email.',
      format: String,
      default: 'owner@sushantmobile.local',
      env: 'OWNER_EMAIL',
    },
    password: {
      doc: 'Seeded owner account password.',
      format: String,
      default: 'changeme123',
      env: 'OWNER_PASSWORD',
      sensitive: true,
    },
  },
});

config.validate({ allowed: 'strict' });

module.exports = config;
