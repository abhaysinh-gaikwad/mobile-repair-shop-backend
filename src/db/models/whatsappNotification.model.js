'use strict';

/**
 * One row per outbound WhatsApp send attempt.
 *
 * Deliberately append-only in spirit (a retry is a new row): a repair's
 * WhatsApp history should read like a log, not a single mutable "last status"
 * field that hides earlier failures.
 */
module.exports = function (sequelize, DataTypes) {
  const WhatsappNotification = sequelize.define(
    'WhatsappNotification',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'customer_id',
        references: { model: 'customers', key: 'id' },
      },
      phoneNumber: { type: DataTypes.STRING(20), allowNull: false, field: 'phone_number' },

      messageType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'RECEIPT', field: 'message_type' },
      templateName: { type: DataTypes.STRING(120), allowNull: true, field: 'template_name' },

      whatsappMessageId: { type: DataTypes.STRING(120), allowNull: true, field: 'whatsapp_message_id' },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      errorCode: { type: DataTypes.STRING(20), allowNull: true, field: 'error_code' },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },

      sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
      sentBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'sent_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'whatsapp_notifications',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [{ fields: ['repair_job_id'] }, { fields: ['customer_id'] }, { fields: ['status'] }],
    },
  );

  WhatsappNotification.associate = function (models) {
    WhatsappNotification.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    WhatsappNotification.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    WhatsappNotification.belongsTo(models.AdminUser, { foreignKey: 'sentBy', as: 'sender' });
  };

  return WhatsappNotification;
};
