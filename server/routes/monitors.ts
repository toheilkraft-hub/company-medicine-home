import { Router } from "express";
import {
  listMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  pauseAll,
  stopAll,
  runNow,
} from "../controllers/monitorController.js";

const router = Router();

router.get("/", listMonitors);
// named routes MUST come before /:id so Express doesn't treat them as IDs
router.post("/pause-all", pauseAll);
router.post("/stop-all", stopAll);
router.post("/", createMonitor);
router.post("/:id/run", runNow);
router.patch("/:id", updateMonitor);
router.delete("/:id", deleteMonitor);

export default router;
