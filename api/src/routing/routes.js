import { Router } from "express";
import {
  login,
  register
} from "../controllers/authController.js";
import {
  createParking,
  getParking,
  getParkings
} from "../controllers/parkingController.js";
import {
  cancel,
  complete,
  create,
  createExtension,
  edit,
  getMine,
  pay
} from "../controllers/reservationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ data: { status: "ok" } });
});

router.post("/auth/register", register);
router.post("/auth/login", login);
//router.post("/auth/password-reset/request", requestPasswordReset);
//router.post("/auth/password-reset/confirm", resetPassword);

router.get("/parking", getParkings);
router.post("/parking", createParking);
router.get("/parking/:parkingId", getParking);

router.post("/reservations", requireAuth, create);
router.get("/reservations/me", requireAuth, getMine);
router.patch("/reservations/:reservationId", requireAuth, edit);
router.delete("/reservations/:reservationId", requireAuth, cancel);
router.post(
  "/reservations/:reservationId/extensions",
  requireAuth,
  createExtension
);
router.post("/reservations/:reservationId/pay", requireAuth, pay);
router.post("/reservations/:reservationId/complete", requireAuth, complete);

export default router;
