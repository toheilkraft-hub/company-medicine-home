import { Router } from "express";
import { register, login, logout, me, updateProfile, changePassword } from "../controllers/authController.js";
import { requireAuth } from "../utils/helpers.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.patch("/profile", requireAuth, updateProfile);
router.post("/change-password", requireAuth, changePassword);

export default router;
