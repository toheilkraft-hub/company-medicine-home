import { Router } from "express";
import { listConfigs, upsertConfig } from "../controllers/collectorConfigController.js";

const router = Router();

router.get("/", listConfigs);
router.put("/:collectorId", upsertConfig);

export default router;
