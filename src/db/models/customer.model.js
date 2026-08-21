'use strict';

module.exports = function (sequelize, DataTypes) {
  const Customer = sequelize.define(
    'Customer',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      mobile: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      alternateMobile: { type: DataTypes.STRING(20), allowNull: true, field: 'alternate_mobile' },
      address: { type: DataTypes.TEXT, allowNull: true },

      // First-touch attribution. Each repair job ALSO snapshots its own lead
      // source, so a returning customer's later visits are attributed to the
      // channel that actually brought them back.
      leadSource: { type: DataTypes.STRING(60), allowNull: true, field: 'lead_source' },
      leadHandlerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'lead_handler_id',
        references: { model: 'lead_handlers', key: 'id' },
      },

      firstVisitAt: { type: DataTypes.DATE, allowNull: true, field: 'first_visit_at' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'customers',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['mobile'] }, { fields: ['name'] }],
    },
  );

  Customer.associate = function (models) {
    Customer.belongsTo(models.LeadHandler, { foreignKey: 'leadHandlerId', as: 'leadHandler' });
    Customer.hasMany(models.RepairJob, { foreignKey: 'customerId', as: 'repairJobs' });
  };

  return Customer;
};
