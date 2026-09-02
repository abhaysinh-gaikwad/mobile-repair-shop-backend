import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * The quote components for a repair — e.g. "500 original screen",
 * "300 market battery".
 *
 * These rows are EDITABLE and DELETABLE, at the shop's explicit request:
 * quotes get mistyped at a busy counter and staff want to correct the row
 * rather than leave a wrong figure sitting on the job forever. The earlier
 * append-only rule (a correction had to be a new row) made the itemised list
 * confusing to read and was dropped deliberately — the trade-off is that a
 * past quote can be changed with no record that it differed. Money that has
 * actually changed hands is NOT affected: `repair_ledger` remains strictly
 * append-only with reversals, and nothing here can touch it.
 *
 * `repair_jobs.estimated_cost` is kept as the SUM of every component, so
 * every existing reader (receipt, WhatsApp message, list views) keeps
 * working unchanged; this table is the itemized record behind that number.
 *
 * A row's `amount` may be 0: a component can be pure text ("screen, price
 * TBD") with no figure in it yet.
 */

/** Recompute the job's quoted total from its rows. Call after any change. */
async function syncEstimatedCost(repairJob, transaction) {
  const rows = await db.RepairEstimate.findAll({
    where: { repairJobId: repairJob.id },
    attributes: ['amount'],
    transaction,
  });

  // Null rather than 0 when nothing carries a real figure — a job quoted
  // only in words has no total, and "₹0.00" would read as "we quoted them
  // nothing". Matches how createRepair.service.js seeds it.
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const hasFigure = rows.some((row) => Number(row.amount) > 0);

  await repairJob.update({ estimatedCost: hasFigure ? round2(total) : null }, { transaction });
}

export class AddEstimateService extends BaseHandler {
  async run() {
    const { repairJobId, amount, note, adminId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const estimate = await db.RepairEstimate.create(
      { repairJobId, amount: round2(amount ?? 0), note: note?.trim() || null, createdBy: adminId ?? null },
      { transaction },
    );

    await syncEstimatedCost(repairJob, transaction);

    return { ...getSuccessResponse('Estimate added successfully.'), estimate };
  }
}

export class UpdateEstimateService extends BaseHandler {
  async run() {
    const { repairJobId, estimateId, amount, note } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    // Scoped to the job in the URL, so an id from another repair can't be
    // edited by guessing it.
    const estimate = await db.RepairEstimate.findOne({ where: { id: estimateId, repairJobId }, transaction });
    if (!estimate) throw new AppError(Errors.ESTIMATE_NOT_FOUND);

    await estimate.update(
      { amount: round2(amount ?? 0), note: note?.trim() || null },
      { transaction },
    );

    await syncEstimatedCost(repairJob, transaction);

    return { ...getSuccessResponse('Estimate updated successfully.'), estimate };
  }
}

export class DeleteEstimateService extends BaseHandler {
  async run() {
    const { repairJobId, estimateId } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const estimate = await db.RepairEstimate.findOne({ where: { id: estimateId, repairJobId }, transaction });
    if (!estimate) throw new AppError(Errors.ESTIMATE_NOT_FOUND);

    await estimate.destroy({ transaction });
    await syncEstimatedCost(repairJob, transaction);

    return getSuccessResponse('Estimate removed.');
  }
}

export class GetEstimatesService extends BaseHandler {
  async run() {
    const { repairJobId } = this.args;

    const repairJob = await db.RepairJob.findByPk(repairJobId);
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const estimates = await db.RepairEstimate.findAll({
      where: { repairJobId },
      include: [{ model: db.AdminUser, as: 'creator', attributes: ['id', 'name'] }],
      // Newest first — the shop wants the latest quote at the top.
      order: [['createdAt', 'DESC']],
    });

    return { ...getSuccessResponse('Estimates fetched successfully.'), estimates };
  }
}
