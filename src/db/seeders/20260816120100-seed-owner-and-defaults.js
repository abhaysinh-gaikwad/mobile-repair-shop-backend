'use strict';

const path = require('path');

const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const LEAD_SOURCES = [
  'Google Maps',
  'Google Ads',
  'WhatsApp',
  'Instagram',
  'Instagram Reels',
  'Facebook',
  'Referral',
  'Walk-in',
  'Existing Customer',
  'Other',
];

/**
 * Shop details are taken from the shop's own paper receipt. The Marathi
 * strings below are a best-effort transcription from a photograph and MUST be
 * proof-read by the owner before the first real receipt is printed — they are
 * stored as editable settings precisely so that can be done without a code
 * change.
 */
const SETTINGS = [
  ['shop_name', 'Sushant Mobile Repairing Center', 'Shop name (English, for the dashboard)'],
  ['shop_name_marathi', 'सुशांत मोबाईल रिपेअरींग सेंटर', 'Shop name printed on the receipt'],
  [
    'shop_address_marathi',
    'ब्राम्हणपुरी, स्वामी समर्थ मंदिराशेजारी, ईश्वरपूर',
    'Shop address printed on the receipt',
  ],
  ['shop_phone_1', '9763636381', 'Primary contact number'],
  ['shop_phone_2', '8007187348', 'Secondary contact number'],
  ['receipt_prefix', 'R-', 'Prefix for generated receipt numbers'],
  ['receipt_paper_size', 'A5', 'Printed receipt paper size: A5 or 80mm'],
  ['receipt_copies', '2', 'Copies printed per receipt (shop + customer)'],
  ['default_warranty_days', '0', 'Default warranty in days (the shop gives none by default)'],
  [
    'receipt_terms_marathi',
    [
      '१) मोबाईल रिपेअरची वॉरंटी व गॅरंटी दिली जाणार नाही.',
      '२) कस्टमरने हॅंडसेट जागेवर चेक करून घेऊन जाणे.',
      '३) कस्टमरने हॅंडसेट १५ दिवसांच्या आत चेकअप करणे.',
      '४) रिपेअरी करीत असताना हॅंडसेट डेड झाल्यास अथवा कांही प्रॉब्लेम झाल्यास दुकानदार जबाबदार राहणार नाही.',
      '५) कस्टमरने (रिसिट) पावती जमा केल्याशिवाय मोबाईल मिळणार नाही.',
      '६) मोबाईल रिपेअरी करताना हॅंडसेट मधील डेटा किंवा कॉन्टॅक्ट नंबर गेल्यास दुकानदार जबाबदार राहणार नाही.',
    ].join('\n'),
    'Terms printed at the foot of the receipt (one per line)',
  ],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ---- Owner account ----
    const ownerEmail = process.env.OWNER_EMAIL || 'owner@sushantmobile.local';
    const ownerPassword = process.env.OWNER_PASSWORD || 'changeme123';
    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    // Idempotent: re-running the seeder must not create a duplicate owner or
    // reset a password the shop has already changed.
    await queryInterface.sequelize.query(
      `INSERT INTO public.admin_users (name, email, password, is_active, created_at, updated_at)
       VALUES (:name, :email, :password, true, :now, :now)
       ON CONFLICT (email) DO NOTHING;`,
      {
        replacements: {
          name: process.env.OWNER_NAME || 'Shop Owner',
          email: ownerEmail,
          password: passwordHash,
          now,
        },
      },
    );

    // ---- Lead sources ----
    for (const [index, name] of LEAD_SOURCES.entries()) {
      await queryInterface.sequelize.query(
        `INSERT INTO public.lead_sources (name, display_order, is_active, created_at, updated_at)
         VALUES (:name, :order, true, :now, :now)
         ON CONFLICT (name) DO NOTHING;`,
        { replacements: { name, order: index, now } },
      );
    }

    // ---- Shop settings ----
    for (const [key, value, description] of SETTINGS) {
      await queryInterface.sequelize.query(
        `INSERT INTO public.shop_settings (key, value, description, created_at, updated_at)
         VALUES (:key, :value, :description, :now, :now)
         ON CONFLICT (key) DO NOTHING;`,
        { replacements: { key, value, description, now } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE FROM public.shop_settings;');
    await queryInterface.sequelize.query('DELETE FROM public.lead_sources;');
    await queryInterface.sequelize.query('DELETE FROM public.admin_users WHERE email = :email;', {
      replacements: { email: process.env.OWNER_EMAIL || 'owner@sushantmobile.local' },
    });
  },
};
