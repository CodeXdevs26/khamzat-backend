import { TAuthUser, TRequest } from "../../interface/global.interface";
import handleAsyncRequest from "../../utils/handleAsyncRequest";
import pick from "../../utils/pick";
import { sendResponse } from "../../utils/sendResponse";
import { notificationServices } from "./notification.service";

const createADummyNotification = handleAsyncRequest(
  async (req: TRequest, res) => {
    const user = req.user as TAuthUser;
    const result = await notificationServices.createADummyNotification(
      user.id,
      req.body
    );

    sendResponse(res, {
      status: 201,
      message: "Dummy notification created successfully!",
      data: result,
    });
  }
);

const getMyNotification = handleAsyncRequest(async (req: TRequest, res) => {
  const user = req.user as TAuthUser;
  const options = pick(req.query, ["page", "limit", "sortBy", "orderBy"]);
  const read =
    req.query.read === "true"
      ? true
      : req.query.read === "false"
        ? false
        : undefined;
  const result = await notificationServices.getMyNotification(
    user.id,
    options,
    read
  );

  sendResponse(res, {
    message: "Notifications retrieved successfully!",
    data: result,
  });
});

const markAllRead = handleAsyncRequest(async (req: TRequest, res) => {
  const user = req.user as TAuthUser;
  const result = await notificationServices.markAllRead(user.id);

  sendResponse(res, {
    message: "All notifications marked as read!",
    data: result,
  });
});

const deleteANotification = handleAsyncRequest(async (req: TRequest, res) => {
  const user = req.user as TAuthUser;
  const result = await notificationServices.deleteANotification(
    user.id,
    req.params.id as string
  );

  sendResponse(res, {
    message: "Notification deleted successfully!",
    data: result,
  });
});

const clearAllNotification = handleAsyncRequest(async (req: TRequest, res) => {
  const user = req.user as TAuthUser;
  const result = await notificationServices.clearAllNotification(user.id);

  sendResponse(res, {
    message: "All notifications cleared successfully!",
    data: result,
  });
});

export const notificationController = {
  createADummyNotification,
  getMyNotification,
  markAllRead,
  deleteANotification,
  clearAllNotification,
};
