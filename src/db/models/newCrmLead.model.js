'use strict';

/**
 * "New CRM" — a lead-tracking module for telecallers, deliberately separate
 * from the existing `Lead` board (leads/lead_assignments). Nothing here is
 * read by, or feeds, that module.
 */
module.exports = function (sequelize, DataTypes) {
  const NewCrmLead = sequelize.define(
    'NewCrmLead',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      // "NCL-000001" — generated once at creation, never reused or edited.
      serialNo: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'serial_no' },
      telecallerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'telecaller_id',
        references: { model: 'admin_users', key: 'id' },
      },
      leadDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'lead_date' },
      customerName: { type: DataTypes.STRING(120), allowNull: false, field: 'customer_name' },
      location: { type: DataTypes.STRING(120), allowNull: true },
      mobileNumber: { type: DataTypes.STRING(20), allowNull: false, field: 'mobile_number' },
      modelNumber: { type: DataTypes.STRING(120), allowNull: true, field: 'model_number' },
      problem: { type: DataTypes.TEXT, allowNull: true },
      telecallerRate: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'telecaller_rate' },
      // Free-text, not an enum — new statuses can be introduced without a
      // migration. The frontend offers a fixed starter list of values.
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'NEW' },
      followUpDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'follow_up_date' },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      tableName: 'new_crm_leads',
      schema: 'public',
      underscored: true,
      indexes: [{ fields: ['telecaller_id'] }, { fields: ['status'] }, { fields: ['lead_date'] }],
    },
  );

  NewCrmLead.associate = function (models) {
    NewCrmLead.belongsTo(models.AdminUser, { foreignKey: 'telecallerId', as: 'telecaller' });
    NewCrmLead.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return NewCrmLead;
};
