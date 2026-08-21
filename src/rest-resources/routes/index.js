import express from 'express';

import db from '@src/db/models';
import apiRouter from './api';

const routes = express.Router();

routes.use('/api', apiRouter);

routes.get('/healthcheck', async (_req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({ data: { status: 'ok', database: 'connected' }, errors: [] });
  } catch {
    res.status(503).json({ data: {}, errors: { statusCode: 503, message: 'Database unavailable' } });
  }
});

export default routes;
