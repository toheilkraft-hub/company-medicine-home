import { Router } from "express";
import { requireAuth } from "../utils/helpers.js";
import { listItems, getItem, updateItemStatus } from "../controllers/inboxController.js";

const router = Router();

router.use(requireAuth);

router.get("/", listItems);
router.get("/:id", getItem);
router.patch("/:id", updateItemStatus);

export default router;
