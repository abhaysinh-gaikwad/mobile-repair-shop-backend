import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

export class GetEngineersService extends BaseHandler {
  async run() {
    const { page = 1, limit = 50, isActive, search } = this.args;

    const where = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (search) where.name = { [Op.iLike]: `%${String(search).trim()}%` };

    const { rows, count } = await db.Engineer.findAndCountAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      ...getSuccessResponse('Engineers fetched successfully.'),
      engineers: rows,
      pagination: getPaginationResponse({ totalCount: count, page, limit, count: rows.length }),
    };
  }
}

export class CreateEngineerService extends BaseHandler {
  async run() {
    const { name, mobile, specialization, notes } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.Engineer.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));

    const engineer = await db.Engineer.create(
      {
        name: trimmedName,
        mobile: mobile ?? null,
        specialization: specialization ?? null,
        notes: notes ?? null,
      },
      { transaction },
    );

    return { ...getSuccessResponse('Engineer added successfully.'), engineer };
  }
}

export class UpdateEngineerService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const engineer = await db.Engineer.findByPk(id, { transaction });
    if (!engineer) throw new AppError(Errors.ENGINEER_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.Engineer.findOne({
        where: { name: trimmedName, id: { [Op.ne]: id } },
        transaction,
      });
      if (clash) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));
      updates.name = trimmedName;
    }

    await engineer.update(updates, { transaction });

    return { ...getSuccessResponse('Engineer updated successfully.'), engineer };
  }
}

/**
 * Activate / deactivate. Engineers are never deleted — historical repair jobs
 * must keep pointing at whoever actually did the work.
 */
export class ToggleEngineerStatusService extends BaseHandler {
  async run() {
    const { id, isActive } = this.args;
    const transaction = this.dbTransaction;

    const engineer = await db.Engineer.findByPk(id, { transaction });
    if (!engineer) throw new AppError(Errors.ENGINEER_NOT_FOUND);

    await engineer.update({ isActive }, { transaction });

    return {
      ...getSuccessResponse(`Engineer ${isActive ? 'activated' : 'deactivated'} successfully.`),
      engineer,
    };
  }
}
