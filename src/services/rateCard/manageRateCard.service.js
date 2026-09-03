import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2, toAmount } from '@src/utils/money.utils';

/**
 * Rate Card — a price lookup for telecallers on a live call, built out of
 * four small reference lists (brand, model, part, rate type) and one entry
 * table joining model+part+rate-type to a price. See the migration
 * (20260902170000-create-rate-card.js) for the full shape and reasoning.
 *
 * Reference-list CRUD (brand/model/part/rate-type) mirrors
 * manageLeads.service.js exactly: create checks for a duplicate name first,
 * update re-checks on rename, nothing is ever hard-deleted — is_active only,
 * because a name in use by an existing rate entry must not disappear from
 * under it.
 */

const serializeEntry = (entry) => ({ ...entry.toJSON(), price: round2(toAmount(entry.price)) });

// ------------------------------------------------------------------ brands
export class GetRateCardBrandsService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const brands = await db.RateCardBrand.findAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Brands fetched successfully.'), brands };
  }
}

export class CreateRateCardBrandService extends BaseHandler {
  async run() {
    const { name, adminId } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.RateCardBrand.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.RATE_CARD_BRAND_EXISTS(trimmedName));

    const brand = await db.RateCardBrand.create({ name: trimmedName, createdBy: adminId ?? null }, { transaction });

    return { ...getSuccessResponse('Brand added successfully.'), brand };
  }
}

export class UpdateRateCardBrandService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const brand = await db.RateCardBrand.findByPk(id, { transaction });
    if (!brand) throw new AppError(Errors.RATE_CARD_BRAND_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.RateCardBrand.findOne({ where: { name: trimmedName, id: { [Op.ne]: id } }, transaction });
      if (clash) throw new AppError(Errors.RATE_CARD_BRAND_EXISTS(trimmedName));
      updates.name = trimmedName;
    }

    await brand.update(updates, { transaction });

    return { ...getSuccessResponse('Brand updated successfully.'), brand };
  }
}

// ------------------------------------------------------------------ models
export class GetRateCardModelsService extends BaseHandler {
  async run() {
    const { brandId, isActive, search } = this.args;
    const where = {};
    if (brandId) where.brandId = brandId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) where.name = { [Op.iLike]: `%${String(search).trim()}%` };

    const models = await db.RateCardModel.findAll({
      where,
      include: [{ model: db.RateCardBrand, as: 'brand', attributes: ['id', 'name'] }],
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Models fetched successfully.'), models };
  }
}

export class CreateRateCardModelService extends BaseHandler {
  async run() {
    const { brandId, name, adminId } = this.args;
    const transaction = this.dbTransaction;

    const brand = await db.RateCardBrand.findByPk(brandId, { transaction });
    if (!brand) throw new AppError(Errors.RATE_CARD_BRAND_NOT_FOUND);

    const trimmedName = String(name).trim();
    const existing = await db.RateCardModel.findOne({ where: { brandId, name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.RATE_CARD_MODEL_EXISTS(trimmedName));

    const model = await db.RateCardModel.create(
      { brandId, name: trimmedName, createdBy: adminId ?? null },
      { transaction },
    );

    return { ...getSuccessResponse('Model added successfully.'), model };
  }
}

export class UpdateRateCardModelService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const model = await db.RateCardModel.findByPk(id, { transaction });
    if (!model) throw new AppError(Errors.RATE_CARD_MODEL_NOT_FOUND);

    const brandId = updates.brandId ?? model.brandId;
    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.RateCardModel.findOne({
        where: { brandId, name: trimmedName, id: { [Op.ne]: id } },
        transaction,
      });
      if (clash) throw new AppError(Errors.RATE_CARD_MODEL_EXISTS(trimmedName));
      updates.name = trimmedName;
    }

    await model.update(updates, { transaction });

    return { ...getSuccessResponse('Model updated successfully.'), model };
  }
}

// ------------------------------------------------------------------- parts
export class GetRateCardPartsService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const parts = await db.RateCardPart.findAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Parts fetched successfully.'), parts };
  }
}

export class CreateRateCardPartService extends BaseHandler {
  async run() {
    const { name, adminId } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.RateCardPart.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.RATE_CARD_PART_EXISTS(trimmedName));

    const part = await db.RateCardPart.create({ name: trimmedName, createdBy: adminId ?? null }, { transaction });

    return { ...getSuccessResponse('Part added successfully.'), part };
  }
}

export class UpdateRateCardPartService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const part = await db.RateCardPart.findByPk(id, { transaction });
    if (!part) throw new AppError(Errors.RATE_CARD_PART_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.RateCardPart.findOne({ where: { name: trimmedName, id: { [Op.ne]: id } }, transaction });
      if (clash) throw new AppError(Errors.RATE_CARD_PART_EXISTS(trimmedName));
      updates.name = trimmedName;
    }

    await part.update(updates, { transaction });

    return { ...getSuccessResponse('Part updated successfully.'), part };
  }
}

// --------------------------------------------------------------- rate types
export class GetRateTypesService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const rateTypes = await db.RateType.findAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Rate types fetched successfully.'), rateTypes };
  }
}

export class CreateRateTypeService extends BaseHandler {
  async run() {
    const { name, adminId } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.RateType.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.RATE_TYPE_EXISTS(trimmedName));

    const rateType = await db.RateType.create({ name: trimmedName, createdBy: adminId ?? null }, { transaction });

    return { ...getSuccessResponse('Rate type added successfully.'), rateType };
  }
}

export class UpdateRateTypeService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const rateType = await db.RateType.findByPk(id, { transaction });
    if (!rateType) throw new AppError(Errors.RATE_TYPE_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.RateType.findOne({ where: { name: trimmedName, id: { [Op.ne]: id } }, transaction });
      if (clash) throw new AppError(Errors.RATE_TYPE_EXISTS(trimmedName));
      updates.name = trimmedName;
    }

    await rateType.update(updates, { transaction });

    return { ...getSuccessResponse('Rate type updated successfully.'), rateType };
  }
}

/** Deactivate rather than delete — an old rate entry may still reference the name. */
export class ToggleRateCardEntityService extends BaseHandler {
  async run() {
    const { id, isActive, entity } = this.args;
    const transaction = this.dbTransaction;

    const modelByEntity = {
      brand: [db.RateCardBrand, Errors.RATE_CARD_BRAND_NOT_FOUND],
      model: [db.RateCardModel, Errors.RATE_CARD_MODEL_NOT_FOUND],
      part: [db.RateCardPart, Errors.RATE_CARD_PART_NOT_FOUND],
      rateType: [db.RateType, Errors.RATE_TYPE_NOT_FOUND],
    };
    const [Model, notFound] = modelByEntity[entity] ?? [];
    if (!Model) throw new AppError(Errors.NOT_FOUND);

    const record = await Model.findByPk(id, { transaction });
    if (!record) throw new AppError(notFound);

    await record.update({ isActive }, { transaction });

    return { ...getSuccessResponse('Updated successfully.'), record };
  }
}

// ----------------------------------------------------------------- entries
export class AddRateCardEntryService extends BaseHandler {
  async run() {
    const { modelId, partId, rateTypeId, price, notes, adminId } = this.args;
    const transaction = this.dbTransaction;

    const [model, part, rateType] = await Promise.all([
      db.RateCardModel.findByPk(modelId, { transaction }),
      db.RateCardPart.findByPk(partId, { transaction }),
      db.RateType.findByPk(rateTypeId, { transaction }),
    ]);
    if (!model) throw new AppError(Errors.RATE_CARD_MODEL_NOT_FOUND);
    if (!part) throw new AppError(Errors.RATE_CARD_PART_NOT_FOUND);
    if (!rateType) throw new AppError(Errors.RATE_TYPE_NOT_FOUND);

    const existing = await db.RateCardEntry.findOne({ where: { modelId, partId, rateTypeId }, transaction });
    if (existing) throw new AppError(Errors.RATE_CARD_ENTRY_EXISTS);

    const entry = await db.RateCardEntry.create(
      {
        modelId,
        partId,
        rateTypeId,
        price: round2(price),
        notes: notes?.trim() || null,
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    return { ...getSuccessResponse('Rate added successfully.'), entry: serializeEntry(entry) };
  }
}

export class UpdateRateCardEntryService extends BaseHandler {
  async run() {
    const { id, price, notes, adminId } = this.args;
    const transaction = this.dbTransaction;

    const entry = await db.RateCardEntry.findByPk(id, { transaction });
    if (!entry) throw new AppError(Errors.RATE_CARD_ENTRY_NOT_FOUND);

    const updates = { updatedBy: adminId ?? null };
    if (price !== undefined) updates.price = round2(price);
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    await entry.update(updates, { transaction });

    return { ...getSuccessResponse('Rate updated successfully.'), entry: serializeEntry(entry) };
  }
}

export class DeleteRateCardEntryService extends BaseHandler {
  async run() {
    const { id } = this.args;
    const transaction = this.dbTransaction;

    const entry = await db.RateCardEntry.findByPk(id, { transaction });
    if (!entry) throw new AppError(Errors.RATE_CARD_ENTRY_NOT_FOUND);

    await entry.destroy({ transaction });

    return getSuccessResponse('Rate removed.');
  }
}

/**
 * The screen telecallers actually use: pick a model, get every rate for it
 * grouped by part. One call instead of walking brand -> model -> part ->
 * rate one round trip at a time while a customer is on the line.
 */
export class GetRatesForModelService extends BaseHandler {
  async run() {
    const { modelId } = this.args;

    const model = await db.RateCardModel.findByPk(modelId, {
      include: [{ model: db.RateCardBrand, as: 'brand', attributes: ['id', 'name'] }],
    });
    if (!model) throw new AppError(Errors.RATE_CARD_MODEL_NOT_FOUND);

    const entries = await db.RateCardEntry.findAll({
      where: { modelId },
      include: [
        { model: db.RateCardPart, as: 'part', attributes: ['id', 'name'] },
        { model: db.RateType, as: 'rateType', attributes: ['id', 'name'] },
      ],
      order: [
        [{ model: db.RateCardPart, as: 'part' }, 'name', 'ASC'],
        ['price', 'DESC'],
      ],
    });

    // Grouped by part so the UI can render "Display: Original ₹3000, Market
    // ₹2000, ..." as one block per part without doing the grouping itself.
    const byPart = new Map();
    for (const entry of entries) {
      const key = entry.part.id;
      if (!byPart.has(key)) byPart.set(key, { part: entry.part, rates: [] });
      byPart.get(key).rates.push({
        id: entry.id,
        rateType: entry.rateType,
        price: round2(toAmount(entry.price)),
        notes: entry.notes,
      });
    }

    return {
      ...getSuccessResponse('Rates fetched successfully.'),
      model: { id: model.id, name: model.name, brand: model.brand },
      parts: Array.from(byPart.values()),
    };
  }
}

/**
 * Quick model search across all brands — "Samsung A35", "iPhone 13" — for
 * the single search box on the lookup screen, as an alternative to the
 * brand-then-model dropdowns.
 */
export class SearchRateCardModelsService extends BaseHandler {
  async run() {
    const { search } = this.args;
    const term = String(search ?? '').trim();
    if (!term) return { ...getSuccessResponse('Models fetched successfully.'), models: [] };

    const models = await db.RateCardModel.findAll({
      where: {
        isActive: true,
        [Op.or]: [{ name: { [Op.iLike]: `%${term}%` } }, { '$brand.name$': { [Op.iLike]: `%${term}%` } }],
      },
      include: [{ model: db.RateCardBrand, as: 'brand', attributes: ['id', 'name'], where: { isActive: true } }],
      order: [['name', 'ASC']],
      limit: 20,
    });

    return { ...getSuccessResponse('Models fetched successfully.'), models };
  }
}
