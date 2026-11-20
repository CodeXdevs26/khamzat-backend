import { TNotification } from "../modules/notification/notification.interface";
import { getMessaging } from "./firebase";
import prisma from "./prisma";

const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

// Stores the notification and pushes it through FCM. Never throws, so a
// failed push cannot break the request that triggered it.
export const sendNotification = async (payload: TNotification) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        receiverId: payload.receiverId,
        message: payload.message,
        description: payload.description,
        modelType: payload.modelType,
        referenceId: payload.referenceId ?? null,
      },
    });

    const messaging = getMessaging();
    if (!messaging) return notification;

    const receiver = await prisma.auth.findUnique({
      where: { id: payload.receiverId },
      select: { fcmToken: true },
    });
    if (!receiver?.fcmToken) return notification;

    try {
      await messaging.send({
        token: receiver.fcmToken,
        notification: {
          title: payload.message,
          ...(payload.description ? { body: payload.description } : {}),
        },
        data: {
          notificationId: notification.id,
          modelType: payload.modelType,
          referenceId: payload.referenceId ?? "",
        },
      });
    } catch (error: unknown) {
      if (
        INVALID_TOKEN_CODES.includes((error as { code?: string })?.code ?? "")
      ) {
        await prisma.auth.update({
          where: { id: payload.receiverId },
          data: { fcmToken: null },
        });
      } else {
        console.error(
          "FCM send failed:",
          error instanceof Error ? error.message : error
        );
      }
    }

    return notification;
  } catch (error: unknown) {
    console.error(
      "sendNotification failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
};
