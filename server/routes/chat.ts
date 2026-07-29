import { Router } from "express";
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  clearConversation,
  sendMessage,
  streamMessage,
  getModels,
} from "../controllers/chatController.js";
import { requireAuth } from "../utils/helpers.js";

const router = Router();
router.use(requireAuth);

router.get("/models", getModels);
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id", getConversation);
router.patch("/conversations/:id", updateConversation);
router.delete("/conversations/:id", deleteConversation);
router.delete("/conversations/:id/messages", clearConversation);
router.post("/conversations/:id/messages", sendMessage);
router.post("/conversations/:id/stream", streamMessage);

export default router;
