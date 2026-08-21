import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '@src/configs/app.config';
import { TOKEN_TYPE } from '@src/utils/constants/public.constants';

const SALT_ROUNDS = 10;

export const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, SALT_ROUNDS);

export const comparePassword = (plainPassword, hashedPassword) => bcrypt.compare(plainPassword, hashedPassword);

export const generateLoginToken = (adminUser) =>
  jwt.sign(
    {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
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
