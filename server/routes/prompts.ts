import { Router } from "express";
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "../controllers/promptController.js";
import { requireAuth } from "../utils/helpers.js";

const router = Router();
router.use(requireAuth);

router.get("/", listPrompts);
router.post("/", createPrompt);
router.patch("/:id", updatePrompt);
router.delete("/:id", deletePrompt);

export default router;
