'use strict';

/**
 * The Round Robin cursor — a single row (id = 1) holding the last telecaller
 * an automatically-assigned lead went to.
 *
 * In the database rather than in memory for two reasons: the rotation must
 * survive a restart (the box reboots often), and both backend containers must
 * share one position. The assignment service locks this row FOR UPDATE while
 * it decides, which is what makes two simultaneous leads impossible to give
 * to the same person.
 */
module.exports = function (sequelize, DataTypes) {
  const RoundRobinState = sequelize.define(
    'RoundRobinState',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      lastAssignedAdminUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'last_assigned_admin_user_id',
      },
    },
    {
      tableName: 'round_robin_state',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  return RoundRobinState;
};
