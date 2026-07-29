import { Router } from "express";
import { getDashboardStats, getAdminStats } from "../controllers/dashboardController.js";
import { requireAuth, requireAdmin } from "../utils/helpers.js";

const router = Router();

router.get("/stats", requireAuth, getDashboardStats);
router.get("/admin", requireAdmin, getAdminStats);

export default router;
