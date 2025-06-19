// routes/hygieneRoutes.js
import express from "express";
import { getHygieneReport, getSelfHygieneReport } from "../controllers/hygieneController.js";
import { isAuthenticatedEmployee } from "../middlewares/auth.js";


const router = express.Router();

router.get("/", isAuthenticatedEmployee, getHygieneReport);
router.get("/self", isAuthenticatedEmployee, getSelfHygieneReport);

export default router;