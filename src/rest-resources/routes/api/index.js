import express from 'express';

import authRouter from './auth.router';
import engineerRouter from './engineer.router';
import {
  billingRouter,
  customerRouter,
  dashboardRouter,
  leadHandlerRouter,
  leadSourceRouter,
  reportRouter,
  settingRouter,
  supplierRouter,
} from './misc.router';
import repairRouter from './repair.router';

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/repairs', repairRouter);
apiRouter.use('/engineers', engineerRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/lead-handlers', leadHandlerRouter);
apiRouter.use('/lead-sources', leadSourceRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/settings', settingRouter);

export default apiRouter;
