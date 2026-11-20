import { NotificationModelType } from "@prisma/client";
import ApiError from "../../classes/ApiError";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation";
import prisma from "../../utils/prisma";
import { sendNotification } from "../../utils/sendNotification";
import { TDummyNotification } from "./notification.validation";

const createADummyNotification = async (
  userId: string,
  payload: Partial<TDummyNotification>
) => {
  const result = await sendNotification({
    receiverId: userId,
    message: payload.message || "Test notification",
    description: payload.description,
    modelType: payload.modelType || NotificationModelType.Auth,
    referenceId: userId,
  });
  if (!result) throw new ApiError(500, "Failed to create notification!");
  return result;
};

const getMyNotification = async (
  userId: string,
  options: TPaginationOptions,
  read?: boolean
) => {
  const { page, take, skip, sortBy, orderBy } = calculatePagination({
    page: options.page || 1,
    limit: options.limit || 10,
    sortBy: options.sortBy,
    orderBy: options.orderBy,
  });

  const where = {
    receiverId: userId,
    ...(read === undefined ? {} : { read }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy:
        sortBy && orderBy ? { [sortBy]: orderBy } : { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { receiverId: userId, read: false } }),
  ]);

  return {
    meta: { page, limit: take, total, unreadCount },
    notifications,
  };
};

const markAllRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { receiverId: userId, read: false },
    data: { read: true },
  });
  return { updatedCount: result.count };
};

const deleteANotification = async (userId: string, id: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id, receiverId: userId },
  });
  if (!notification) throw new ApiError(404, "Notification not found!");

  await prisma.notification.delete({ where: { id } });
  return null;
};

const clearAllNotification = async (userId: string) => {
  const result = await prisma.notification.deleteMany({
    where: { receiverId: userId },
  });
  return { deletedCount: result.count };
};

export const notificationServices = {
  createADummyNotification,
  getMyNotification,
  markAllRead,
  deleteANotification,
  clearAllNotification,
};
