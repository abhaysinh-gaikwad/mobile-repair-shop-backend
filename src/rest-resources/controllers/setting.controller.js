import { sendResponse } from '@src/helpers/response.helpers';
import { GetSettingsService, UpdateSettingsService } from '@src/services/settings/manageSettings.service';

export default class SettingController {
  static async getSettings(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetSettingsService.execute({}, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const data = await UpdateSettingsService.execute(
        { settings: req.body.settings, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
