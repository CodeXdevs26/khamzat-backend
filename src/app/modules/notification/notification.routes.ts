import { UserRole } from "@prisma/client";
import { Router } from "express";
import authorize from "../../middlewares/authorize";
import validate from "../../middlewares/validate";
import { notificationController } from "./notification.controller";
import { dummyNotificationZod } from "./notification.validation";

const router = Router();
const roles = [UserRole.ADMIN, UserRole.USER] as const;

// Static routes must stay above "/:id".
router.post(
  "/dummy",
  authorize(...roles),
  validate(dummyNotificationZod),
  notificationController.createADummyNotification
);

router.get("/", authorize(...roles), notificationController.getMyNotification);

router.patch(
  "/read-all",
  authorize(...roles),
  notificationController.markAllRead
);

router.delete(
  "/",
  authorize(...roles),
  notificationController.clearAllNotification
);

router.delete(
  "/:id",
  authorize(...roles),
  notificationController.deleteANotification
);

export const notificationRoutes = router;
