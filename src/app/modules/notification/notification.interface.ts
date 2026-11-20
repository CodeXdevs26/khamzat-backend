import { NotificationModelType } from "@prisma/client";

export type TNotification = {
  receiverId: string;
  message: string;
  description?: string;
  modelType: NotificationModelType;
  referenceId?: string | null;
};
