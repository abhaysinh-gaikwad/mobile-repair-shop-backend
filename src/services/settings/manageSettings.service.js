import db from '@src/db/models';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

export class GetSettingsService extends BaseHandler {
  async run() {
    const settings = await db.ShopSetting.findAll({ order: [['key', 'ASC']] });

    // Return both shapes: the flat map is what the receipt and forms consume,
    // the list carries the descriptions for the Settings screen.
    return {
      ...getSuccessResponse('Settings fetched successfully.'),
      settings: settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {}),
      settingsList: settings,
    };
  }
}

/**
 * Bulk upsert. The shop edits several fields at once and expects one save.
 */
export class UpdateSettingsService extends BaseHandler {
  async run() {
    const { settings, adminId } = this.args;
    const transaction = this.dbTransaction;

    for (const [key, value] of Object.entries(settings)) {
      const existing = await db.ShopSetting.findOne({ where: { key }, transaction });

      if (existing) {
        await existing.update({ value: String(value), updatedBy: adminId ?? null }, { transaction });
      } else {
        await db.ShopSetting.create({ key, value: String(value), updatedBy: adminId ?? null }, { transaction });
      }
    }

    const updated = await db.ShopSetting.findAll({ order: [['key', 'ASC']], transaction });

    return {
      ...getSuccessResponse('Settings saved successfully.'),
      settings: updated.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {}),
    };
  }
}
