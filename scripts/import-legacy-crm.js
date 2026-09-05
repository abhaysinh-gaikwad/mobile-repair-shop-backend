/* eslint-disable no-console */
/**
 * Imports the shop's existing CRM spreadsheet (3,421 enquiries, Feb-Sep 2026)
 * into the leads table.
 *
 *   npm run crm:import          # import / update
 *   npm run crm:import -- --dry # report what WOULD happen, change nothing
 *
 * Reads src/data/crm-legacy-leads.json, produced from "SUSHANT CRM.xlsx".
 * Deliberately a pre-converted JSON rather than parsing .xlsx here: it needs
 * no Excel library on a server with ~950MB of RAM, and the messy decisions
 * (transposed dates, "P"/"N" handler suffixes, two-price rate strings) are
 * visible in a reviewable file instead of buried in a parser.
 *
 * Three things this does NOT do, on purpose:
 *
 *  1. It does not go through CreateLeadService. That service runs Round Robin,
 *     and pushing 3,421 historical rows through it would spin the rotation
 *     3,421 times and hand today's real enquiries to whoever happened to land
 *     at the end of the queue. History is imported with the owner it already
 *     had.
 *  2. It does not de-duplicate by mobile number. 233 numbers appear more than
 *     once because those customers genuinely enquired more than once, and
 *     collapsing them would erase that history. (Going FORWARD, new enquiries
 *     from those numbers still stick to their existing telecaller — that is
 *     CreateLeadService's job, and it works off the same column.)
 *  3. It does not invent an owner for the 2,964 rows that never had one.
 */
// Run with babel-node (see the crm:import npm script) exactly as `npm run dev`
// does, so the @src alias and ESM syntax resolve the same way they do
// everywhere else in this codebase.
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

import db from '@src/db/models';
import { ADMIN_ROLE, LEAD_SOURCE, STAFF_AVAILABILITY } from '@src/utils/constants/public.constants';
import { normalizeMobile } from '@src/services/crm/leadAssignment.helpers';

const DRY = process.argv.includes('--dry');
const DATA = path.resolve('src/data/crm-legacy-leads.json');

/**
 * The two telecallers named in the sheet. Created if missing, with an
 * unusable random password — exactly like the migrated lead_handlers accounts.
 * They can be assigned leads immediately; the Super Admin sets a real password
 * from User Management before they can sign in.
 */
const TELECALLERS = ['Pooja', 'Nikita'];

async function ensureTelecaller(name, transaction) {
  const email = `${name.toLowerCase()}@sushantmobile.local`;
  const [user] = await db.AdminUser.findOrCreate({
    where: { email },
    defaults: {
      name,
      email,
      // Random and never disclosed - the account exists to own leads, not to
      // be signed into until a password is deliberately set.
      password: bcrypt.hashSync(`${Date.now()}-${Math.random()}`, 10),
      role: ADMIN_ROLE.TELECALLER,
      availability: STAFF_AVAILABILITY.AVAILABLE,
      isActive: true,
    },
    transaction,
  });
  return user;
}

async function main() {
  if (!fs.existsSync(DATA)) throw new Error(`Missing ${DATA}`);
  const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  console.log(`Read ${rows.length} rows from crm-legacy-leads.json${DRY ? '  (DRY RUN)' : ''}\n`);

  const transaction = await db.sequelize.transaction();
  try {
    const owners = {};
    for (const name of TELECALLERS) {
      const user = await ensureTelecaller(name, transaction);
      owners[name] = user.id;
      console.log(`  telecaller ${name.padEnd(8)} -> admin_users.id ${user.id}`);
    }
    console.log();

    // One query instead of 3,421: which spreadsheet rows are already imported.
    const existing = new Map(
      (await db.Lead.findAll({ attributes: ['id', 'legacyRowNo'], where: { source: LEAD_SOURCE.OTHER }, transaction }))
        .filter((lead) => lead.legacyRowNo !== null)
        .map((lead) => [lead.legacyRowNo, lead.id]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const pending = [];

    for (const row of rows) {
      if (!row.customerName && !row.mobile) {
        skipped += 1;
        continue;
      }

      const record = {
        legacyRowNo: row.rowNo ?? null,
        customerName: row.customerName,
        mobile: row.mobile,
        mobileNormalized: normalizeMobile(row.mobile),
        location: row.location,
        modelNumber: row.modelNumber,
        problem: row.problem,
        quotedRate: row.quotedRate,
        status: row.status,
        enquiryDate: row.enquiryDate,
        lastCallDate: row.lastCallDate,
        nextActionDate: row.nextActionDate,
        notes: row.notes,
        assignedTo: row.handler ? owners[row.handler] : null,
        // OTHER, not WHATSAPP: the sheet does not record where each enquiry
        // came from, and guessing WhatsApp would make the source report lie.
        source: LEAD_SOURCE.OTHER,
        // The enquiry date is the real "when", so contact history reads
        // correctly rather than showing every one of 3,421 leads as today.
        lastContactAt: row.lastCallDate || row.enquiryDate || null,
        contactCount: 1,
      };

      const existingId = row.rowNo != null ? existing.get(row.rowNo) : undefined;
      if (existingId) {
        if (!DRY) await db.Lead.update(record, { where: { id: existingId }, transaction });
        updated += 1;
      } else {
        pending.push(record);
        created += 1;
      }
    }

    if (!DRY && pending.length) {
      // Chunked so a single 3,400-row INSERT never balloons memory on a box
      // that has very little of it to spare.
      const CHUNK = 250;
      for (let i = 0; i < pending.length; i += CHUNK) {
        await db.Lead.bulkCreate(pending.slice(i, i + CHUNK), { transaction });
        process.stdout.write(`\r  inserting… ${Math.min(i + CHUNK, pending.length)}/${pending.length}`);
      }
      process.stdout.write('\n');
    }

    if (DRY) await transaction.rollback();
    else await transaction.commit();

    console.log(`\n  created ${created}, updated ${updated}, skipped ${skipped}${DRY ? '  (rolled back)' : ''}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const total = await db.Lead.count();
  const byOwner = await db.Lead.findAll({
    attributes: ['assignedTo', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'n']],
    group: ['assignedTo'],
    raw: true,
  });
  console.log(`\n  leads in database: ${total}`);
  for (const row of byOwner) {
    const who = row.assignedTo ? (await db.AdminUser.findByPk(row.assignedTo)).name : 'Unassigned';
    console.log(`    ${who.padEnd(12)} ${row.n}`);
  }

  await db.sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
