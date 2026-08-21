import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

// ------------------------------------------------------------ lead handlers
export class GetLeadHandlersService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const leadHandlers = await db.LeadHandler.findAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Lead handlers fetched successfully.'), leadHandlers };
  }
}

export class CreateLeadHandlerService extends BaseHandler {
  async run() {
    const { name, mobile, notes } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.LeadHandler.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));

    const leadHandler = await db.LeadHandler.create(
      { name: trimmedName, mobile: mobile ?? null, notes: notes ?? null },
      { transaction },
    );

    return { ...getSuccessResponse('Lead handler added successfully.'), leadHandler };
  }
}

export class UpdateLeadHandlerService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const leadHandler = await db.LeadHandler.findByPk(id, { transaction });
    if (!leadHandler) throw new AppError(Errors.LEAD_HANDLER_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.LeadHandler.findOne({
        where: { name: trimmedName, id: { [Op.ne]: id } },
        transaction,
      });
      if (clash) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));
      updates.name = trimmedName;
    }

    await leadHandler.update(updates, { transaction });

    return { ...getSuccessResponse('Lead handler updated successfully.'), leadHandler };
  }
}

// ------------------------------------------------------------- lead sources
export class GetLeadSourcesService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const leadSources = await db.LeadSource.findAll({
      where,
      order: [
        ['displayOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Lead sources fetched successfully.'), leadSources };
  }
}

export class CreateLeadSourceService extends BaseHandler {
  async run() {
    const { name, displayOrder = 0 } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.LeadSource.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.LEAD_SOURCE_EXISTS(trimmedName));

    const leadSource = await db.LeadSource.create({ name: trimmedName, displayOrder }, { transaction });

    return { ...getSuccessResponse('Lead source added successfully.'), leadSource };
  }
}

export class UpdateLeadSourceService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const leadSource = await db.LeadSource.findByPk(id, { transaction });
    if (!leadSource) throw new AppError(Errors.LEAD_SOURCE_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.LeadSource.findOne({
        where: { name: trimmedName, id: { [Op.ne]: id } },
        transaction,
      });
      if (clash) throw new AppError(Errors.LEAD_SOURCE_EXISTS(trimmedName));
      updates.name = trimmedName;
    }

    await leadSource.update(updates, { transaction });

    return { ...getSuccessResponse('Lead source updated successfully.'), leadSource };
  }
}

/** Deactivate rather than delete — repair jobs snapshot the source name. */
export class ToggleLeadEntityService extends BaseHandler {
  async run() {
    const { id, isActive, entity } = this.args;
    const transaction = this.dbTransaction;

    const model = entity === 'handler' ? db.LeadHandler : db.LeadSource;
    const notFound = entity === 'handler' ? Errors.LEAD_HANDLER_NOT_FOUND : Errors.LEAD_SOURCE_NOT_FOUND;

    const record = await model.findByPk(id, { transaction });
    if (!record) throw new AppError(notFound);

    await record.update({ isActive }, { transaction });

    return { ...getSuccessResponse(`Updated successfully.`), record };
  }
}
