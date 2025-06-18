import express from "express";
import { sendTestMail } from "../controllers/emailController.js";

const router = express.Router();

router.get("/test", sendTestMail);

export default router;
