import express from 'express';
import { createLoad, getAvailableLoads, assignLoad, getAllLoads } from '../controllers/loadController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const loadRouter = express.Router();
loadRouter.post('/create', isAuthenticatedUser, createLoad);
loadRouter.get('/available', getAvailableLoads);
loadRouter.get('/all', isAuthenticatedUser, getAllLoads);
loadRouter.put('/assign/:id', isAuthenticatedUser, assignLoad);
export default loadRouter;