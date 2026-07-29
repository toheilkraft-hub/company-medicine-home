import { Router } from "express";
import { getSettings, updateSettings, fetchModels } from "../controllers/settingsController.js";
import { requireAuth } from "../utils/helpers.js";

const router = Router();
router.use(requireAuth);
router.get("/", getSettings);
router.patch("/", updateSettings);
router.post("/models", fetchModels);

export default router;
