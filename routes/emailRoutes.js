import express from "express";
import { fetchInbox, fetchEmailByUid, sendMail, sendReply, deleteEmail, saveDraft } from "../controllers/emailController.js";
import { isAuthenticatedEmployee } from "../middlewares/auth.js";

const router = express.Router();

router.get("/inbox", isAuthenticatedEmployee, fetchInbox);
router.get("/:uid", isAuthenticatedEmployee, fetchEmailByUid);
router.post("/send", isAuthenticatedEmployee, sendMail);
router.post("/reply", isAuthenticatedEmployee, sendReply);
router.delete("/:uid", isAuthenticatedEmployee, deleteEmail);
router.post("/draft", isAuthenticatedEmployee, saveDraft);

export default router;
