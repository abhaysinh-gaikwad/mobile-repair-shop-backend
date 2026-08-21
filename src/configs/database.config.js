// CommonJS on purpose — sequelize-cli loads this file outside of Babel.
//
// NOTE: unlike the reference exchange backend, there is NO read/write
// replication split here. A single shop runs a single database; pretending
// otherwise would just be misleading config.
const config = require('./app.config');

const dbSettings = {
  database: config.get('sequelize.name'),
  username: config.get('sequelize.user'),
  password: config.get('sequelize.password'),
  host: config.get('sequelize.host'),
  port: config.get('sequelize.port'),
  dialect: 'postgres',
  dialectOptions: {
    application_name: config.get('app.name'),
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
