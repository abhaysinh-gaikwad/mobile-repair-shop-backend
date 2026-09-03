'use strict';

/**
 * Rate Card — a lookup, not a repair. Telecallers get asked a price on a
 * live call ("what's a Samsung A35 display?") and need the answer in
 * seconds, without interrupting the shop. Deliberately kept to five tables:
 * brand, model (per brand), part (shared across all brands/models — a
 * "Display" is the same concept whoever makes the phone), rate type
 * (Original / Market / Market Quality 100 / anything the shop invents), and
 * the price entries themselves.
 *
 * None of this is inventory or stock — there is no quantity anywhere in
 * this schema, only a price a telecaller can read out.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') };
    const timestamps = { created_at: { ...now }, updated_at: { ...now } };
    const createdBy = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'admin_users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    };

    // ---- Brands: "Samsung", "Apple", "Vivo" — admin-managed, not a fixed list.
    await queryInterface.createTable(
      'rate_card_brands',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: createdBy,
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('rate_card_brands', ['is_active'], { name: 'rate_card_brands_is_active_idx' });

    // ---- Models: "A35" under Samsung, "13" under Apple. Same model name can
    // exist under different brands, so uniqueness is per-brand, not global.
    await queryInterface.createTable(
      'rate_card_models',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'rate_card_brands', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        name: { type: Sequelize.STRING(120), allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: createdBy,
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('rate_card_models', ['brand_id', 'name'], {
      name: 'rate_card_models_brand_id_name_key',
      unique: true,
    });
    await queryInterface.addIndex('rate_card_models', ['is_active'], { name: 'rate_card_models_is_active_idx' });

    // ---- Parts: "Display", "Battery", "Charging Port" — global, not
    // per-brand/model. The same part name means the same thing everywhere.
    await queryInterface.createTable(
      'rate_card_parts',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: createdBy,
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('rate_card_parts', ['is_active'], { name: 'rate_card_parts_is_active_idx' });

    // ---- Rate types: "Original", "Market", "Market Quality 100" — also
    // global and open-ended, exactly like parts.
    await queryInterface.createTable(
      'rate_types',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: createdBy,
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('rate_types', ['is_active'], { name: 'rate_types_is_active_idx' });

    // ---- The prices themselves: one row per (model, part, rate type).
    // Multiple rate types coexist for the same model+part on purpose — that
    // is the entire point (Original/Market/Market Quality 100 all sit
    // alongside each other, never overwriting one another). The unique
    // index is what enforces "one row per combination" while still allowing
    // as many DIFFERENT rate types as the shop wants.
    await queryInterface.createTable(
      'rate_card_entries',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        model_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'rate_card_models', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        part_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'rate_card_parts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        rate_type_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'rate_types', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: createdBy,
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('rate_card_entries', ['model_id', 'part_id', 'rate_type_id'], {
      name: 'rate_card_entries_model_part_type_key',
      unique: true,
    });
    await queryInterface.addIndex('rate_card_entries', ['part_id'], { name: 'rate_card_entries_part_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'rate_card_entries', schema: 'public' });
    await queryInterface.dropTable({ tableName: 'rate_types', schema: 'public' });
    await queryInterface.dropTable({ tableName: 'rate_card_parts', schema: 'public' });
    await queryInterface.dropTable({ tableName: 'rate_card_models', schema: 'public' });
    await queryInterface.dropTable({ tableName: 'rate_card_brands', schema: 'public' });
  },
};
