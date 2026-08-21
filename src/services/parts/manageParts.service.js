import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { calculatePartTotal, getRepairMoneySummary, recalculateRepairTotal } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * Spare parts fitted during a repair.
 *
 * Every mutation recomputes the parent job's total in the SAME transaction,
 * so the stored total can never drift away from the sum of its parts.
 */

export class AddPartService extends BaseHandler {
  async run() {
    const { repairJobId, partName, quantity = 1, unitPrice = 0, notes } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const part = await db.RepairPart.create(
      {
        repairJobId,
        partName: String(partName).trim(),
        quantity,
        unitPrice: round2(unitPrice),
        totalPrice: calculatePartTotal(unitPrice, quantity),
        notes: notes ?? null,
      },
      { transaction },
    );

    await recalculateRepairTotal(repairJobId, transaction);
    const money = await getRepairMoneySummary(repairJobId, transaction);

    return { ...getSuccessResponse('Part added successfully.'), part, ...money };
  }
}

export class UpdatePartService extends BaseHandler {
  async run() {
    const { repairJobId, partId, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const part = await db.RepairPart.findOne({ where: { id: partId, repairJobId }, transaction });
    if (!part) throw new AppError(Errors.PART_NOT_FOUND);

    const quantity = updates.quantity ?? part.quantity;
    const unitPrice = updates.unitPrice ?? part.unitPrice;

    await part.update(
      { ...updates, totalPrice: calculatePartTotal(unitPrice, quantity) },
      { transaction },
    );

    await recalculateRepairTotal(repairJobId, transaction);
    const money = await getRepairMoneySummary(repairJobId, transaction);

    return { ...getSuccessResponse('Part updated successfully.'), part, ...money };
  }
}

export class DeletePartService extends BaseHandler {
  async run() {
    const { repairJobId, partId } = this.args;
    const transaction = this.dbTransaction;

    const part = await db.RepairPart.findOne({ where: { id: partId, repairJobId }, transaction });
    if (!part) throw new AppError(Errors.PART_NOT_FOUND);

    await part.destroy({ transaction });

    await recalculateRepairTotal(repairJobId, transaction);
    const money = await getRepairMoneySummary(repairJobId, transaction);

    return { ...getSuccessResponse('Part removed successfully.'), ...money };
  }
}
