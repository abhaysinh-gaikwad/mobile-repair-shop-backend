'use strict';

/**
 * Append-only record of who a lead was given to and why.
 *
 * Same discipline as repair_ledger and repair_call_logs: rows are never
 * edited or deleted. A reassignment adds a row, it does not rewrite the
 * previous one — so "who was this originally assigned to, who moved it, and
 * when" stays answerable forever.
 */
module.exports = function (sequelize, DataTypes) {
  const LeadAssignment = sequelize.define(
    'LeadAssignment',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      leadId: { type: DataTypes.INTEGER, allowNull: false, field: 'lead_id' },
      fromAdminUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'from_admin_user_id' },
      toAdminUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'to_admin_user_id' },
      /** ROUND_ROBIN (the rotation), STICKY (repeat customer), MANUAL (a person moved it). */
      reason: { type: DataTypes.STRING(20), allowNull: false },
      changedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'changed_by' },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'lead_assignments',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  LeadAssignment.associate = function (models) {
    LeadAssignment.belongsTo(models.Lead, { foreignKey: 'leadId', as: 'lead' });
    LeadAssignment.belongsTo(models.AdminUser, { foreignKey: 'fromAdminUserId', as: 'fromUser' });
    LeadAssignment.belongsTo(models.AdminUser, { foreignKey: 'toAdminUserId', as: 'toUser' });
    LeadAssignment.belongsTo(models.AdminUser, { foreignKey: 'changedBy', as: 'changer' });
  };

  return LeadAssignment;
};
