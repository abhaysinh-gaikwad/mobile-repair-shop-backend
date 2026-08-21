'use strict';

const fs = require('fs');
const path = require('path');

const { Sequelize, DataTypes } = require('sequelize');

const databaseConfig = require('@src/configs/database.config');

const basename = path.basename(__filename);
const db = {};

const sequelize = new Sequelize(
  databaseConfig.database,
  databaseConfig.username,
  databaseConfig.password,
  databaseConfig,
);

// Every *.model.js in this directory is registered automatically — adding a
// model means dropping the file in, nothing else.
fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.js') && !file.endsWith('.test.js'))
  .forEach((file) => {
    const modelDefiner = require(path.join(__dirname, file));
    const model = (modelDefiner.default || modelDefiner)(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) db[modelName].associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
