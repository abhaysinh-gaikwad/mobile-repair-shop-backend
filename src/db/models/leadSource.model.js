'use strict';

/**
 * The configurable dropdown list of marketing sources.
 *
 * Repair jobs snapshot the source NAME as a string rather than referencing
 * this table, so renaming or removing a source here never rewrites history.
 */
module.exports = function (sequelize, DataTypes) {
  const LeadSource = sequelize.define(
    'LeadSource',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'display_order' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'lead_sources',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  return LeadSource;
};
