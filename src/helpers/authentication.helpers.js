import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '@src/configs/app.config';
import { ADMIN_ROLE, TOKEN_TYPE } from '@src/utils/constants/public.constants';

const SALT_ROUNDS = 10;

export const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, SALT_ROUNDS);

export const comparePassword = (plainPassword, hashedPassword) => bcrypt.compare(plainPassword, hashedPassword);

export const generateLoginToken = (adminUser) =>
  jwt.sign(
    {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      // Falls back to SUPER_ADMIN for the generic { id, email, name } identity
      // receiptPdf.utils.js builds when the real admin lookup fails — that
      // path only ever renders a print page, never a role-gated action.
      //
      // Note this is only the token's CLAIM. Every permission check re-reads
      // the user from the database (see requirePermission), so a forged or
      // stale role in a token grants nothing on its own.
      role: adminUser.role ?? ADMIN_ROLE.SUPER_ADMIN,
      tokenType: TOKEN_TYPE.LOGIN,
    },
    config.get('jwt.loginTokenSecret'),
    { expiresIn: config.get('jwt.loginTokenExpiry') },
  );

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
export const decodeJwtToken = (token) => {
  try {
    return jwt.verify(token, config.get('jwt.loginTokenSecret'));
  } catch {
    return null;
  }
};
