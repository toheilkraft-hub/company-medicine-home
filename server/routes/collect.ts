import { Router } from "express";
import { requireAuth } from "../utils/helpers.js";
import { collectItem } from "../controllers/collectController.js";

const router = Router();

router.use(requireAuth);

// POST /api/collect — standard ingestion endpoint for all collector integrations
router.post("/", collectItem);

export default router;
