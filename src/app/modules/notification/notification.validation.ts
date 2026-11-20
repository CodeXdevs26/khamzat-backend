import { NotificationModelType } from "@prisma/client";
import z from "zod";

export const dummyNotificationZod = z.object({
  message: z.string().min(1).default("Test notification"),
  description: z.string().optional(),
  modelType: z.enum(NotificationModelType).default(NotificationModelType.Auth),
});

export type TDummyNotification = z.infer<typeof dummyNotificationZod>;
