import { Router } from "express";
import { requireAuth } from "../utils/helpers.js";
import { listItems, getItem, updateItemStatus, deleteItem, bulkDeleteItems } from "../controllers/inboxController.js";

const router = Router();

router.use(requireAuth);

router.get("/", listItems);
router.post("/bulk-delete", bulkDeleteItems);
router.get("/:id", getItem);
router.patch("/:id", updateItemStatus);
router.delete("/:id", deleteItem);

export default router;
