// CommonJS on purpose — sequelize-cli loads this file outside of Babel.
//
// NOTE: unlike the reference exchange backend, there is NO read/write
// replication split here. A single shop runs a single database; pretending
// otherwise would just be misleading config.
//
// When DATABASE_URL is set (e.g. Neon on Render), we use the Neon serverless
// WebSocket driver so the connection works over HTTP/WS instead of raw TCP,
// avoiding IPv6 / ENETUNREACH issues on cloud runners.
const config = require('./app.config');

// ── Database connection params ──────────────────────────────────────────────
// When DATABASE_URL is set (Render / Neon), parse it into individual fields
// and enable SSL. Neon's pooler endpoint is IPv4-reachable via standard pg
// TCP+SSL — no special serverless driver needed.
// When DATABASE_URL is absent, fall back to individual DB_* env vars (local dev).
let dbHost, dbPort, dbName, dbUser, dbPassword, sslOptions;

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  dbHost     = url.hostname;
  dbPort     = parseInt(url.port || '5432', 10);
  dbName     = url.pathname.replace(/^\//, '');
  dbUser     = url.username;
  dbPassword = decodeURIComponent(url.password);
  sslOptions = { require: true, rejectUnauthorized: false };
} else {
  dbHost     = config.get('sequelize.host');
  dbPort     = config.get('sequelize.port');
  dbName     = config.get('sequelize.name');
  dbUser     = config.get('sequelize.user');
  dbPassword = config.get('sequelize.password');
  sslOptions = false;
}
// ───────────────────────────────────────────────────────────────────────────

const dbSettings = {
  database: dbName,
  username: dbUser,
  password: dbPassword,
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  dialectOptions: {
    application_name: config.get('app.name'),
    ...(sslOptions ? { ssl: sslOptions } : {}),
  },
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 60000,
    idle: 5000,
  },
  migrationStorage: 'sequelize',
  migrationStorageTableName: 'sequelize_migration_meta',
  seederStorage: 'sequelize',
  seederStorageTableName: 'sequelize_seed_meta',
  define: {
    underscored: true,
    timestamps: true,
  },
};

const databaseOptions = {
  development: { ...dbSettings },
  test: { ...dbSettings },
  staging: { ...dbSettings },
  production: { ...dbSettings },
}[config.get('env')];

module.exports = databaseOptions;
