import { z } from "zod";
import { updateLegalSchema } from "../modules/legal/legal.validation";
import {
  mascotFieldNames,
  removeMascotFieldZod,
} from "../modules/mascot/mascot.validation";
import { dummyNotificationZod } from "../modules/notification/notification.validation";
import {
  updateActiveChapterId,
  updateActiveQuestionId,
  updateProfileZod,
} from "../modules/profile/profile.validation";
import { updateLessonZod } from "../modules/lesson/lesson.validation";
import {
  arrayOf,
  bearer,
  errors,
  jsonBody,
  multipartBody,
  Obj,
  ok,
  paginationParams,
  pathParam,
  queryParam,
  ref,
} from "./helpers";

const admin = "Role: **ADMIN**.";
const both = "Roles: **ADMIN**, **USER**.";
const user = "Role: **USER**.";

const progressDoc = (what: string, body: string) =>
  `${user} Send the id of the ${what} the learner just **finished**; the server saves the **next** one and its parents (rolling over into the next ${body} when needed). Returns the updated \`UserProfile\`. Sends a push when the level (or, within the same level, the chapter) changes.`;

export const profilePaths: Obj = {
  "/profile": {
    get: {
      tags: ["Profile"],
      summary: "Get own profile",
      security: bearer,
      description: both,
      responses: {
        ...ok("Profile", ref("ProfileWithAuth")),
        ...errors("401", "403", "404"),
      },
    },
    patch: {
      tags: ["Profile"],
      summary: "Update own name and/or image",
      security: bearer,
      description: `${both} Multipart. A new image replaces (and deletes) the old one on S3.`,
      requestBody: multipartBody({
        payload: updateProfileZod,
        payloadExample: { name: "New Name" },
        files: [{ name: "image", description: "Profile image" }],
      }),
      responses: {
        ...ok("Profile updated", ref("Profile")),
        ...errors("400", "401", "403", "404"),
      },
    },
  },
  "/profile/active-level": {
    patch: {
      tags: ["Profile"],
      summary: "Advance to the next level",
      security: bearer,
      description: `${user} No body. Moves \`activeLevelId\` to the level with \`index + 1\`. Returns the updated \`UserProfile\`; sends a "Level unlocked" push.`,
      responses: {
        ...ok("Updated progress", ref("UserProfile")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/profile/active-chapter": {
    patch: {
      tags: ["Profile"],
      summary: "Finish a chapter",
      security: bearer,
      description: progressDoc("chapter", "chapter or level"),
      requestBody: jsonBody(updateActiveChapterId, {
        chapterId: "<chapter id>",
      }),
      responses: {
        ...ok("Updated progress", ref("UserProfile")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/profile/active-lesson": {
    patch: {
      tags: ["Profile"],
      summary: "Finish a lesson",
      security: bearer,
      description: progressDoc("lesson", "chapter or level"),
      requestBody: jsonBody(updateLessonZod, { lessonId: "<lesson id>" }),
      responses: {
        ...ok("Updated progress", ref("UserProfile")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/profile/active-question": {
    patch: {
      tags: ["Profile"],
      summary: "Finish a question",
      security: bearer,
      description: progressDoc("question", "lesson, chapter or level"),
      requestBody: jsonBody(updateActiveQuestionId, {
        questionId: "<question id>",
      }),
      responses: {
        ...ok("Updated progress", ref("UserProfile")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/profile/reset-level": {
    patch: {
      tags: ["Profile"],
      summary: "Reset progress to the first question",
      security: bearer,
      description: `${user} No body. Sets all four active pointers to the very first level, chapter, lesson and question. No notification is sent.`,
      responses: {
        ...ok("Updated progress", ref("UserProfile")),
        ...errors("401", "403", "404"),
      },
    },
  },
};

export const mascotPaths: Obj = {
  "/mascots": {
    get: {
      tags: ["Mascot"],
      summary: "Get the mascot images",
      description:
        "Public. The single `default` row of image URLs used on app screens; `data` is `null` until an admin uploads something.",
      responses: { ...ok("Mascot", ref("Mascot")) },
    },
    patch: {
      tags: ["Mascot"],
      summary: "Upload / replace mascot images",
      security: bearer,
      description: `${admin} Multipart, no \`payload\`. Send one or more of the image fields below (max 1 file each); at least one is required. The row is created if missing, and replaced images are deleted from S3.`,
      requestBody: multipartBody({
        files: mascotFieldNames.map(name => ({
          name,
          description: `Image for the \`${name}\` screen`,
        })),
      }),
      responses: {
        ...ok("Mascot updated", ref("Mascot")),
        ...errors("400", "401", "403"),
      },
    },
  },
  "/mascots/remove-field": {
    patch: {
      tags: ["Mascot"],
      summary: "Remove one mascot image",
      security: bearer,
      description: `${admin} Sets the field to \`null\` and deletes the file from S3.`,
      requestBody: jsonBody(removeMascotFieldZod, { field: "splash1" }),
      responses: {
        ...ok("Mascot updated", ref("Mascot")),
        ...errors("400", "401", "403", "404"),
      },
    },
  },
};

export const legalPaths: Obj = {
  "/legal": {
    get: {
      tags: ["Legal"],
      summary: "Get privacy policy, terms and about us",
      description: "Public. `data` is `null` until an admin saves the text.",
      responses: { ...ok("Legal text", ref("Legal")) },
    },
    patch: {
      tags: ["Legal"],
      summary: "Create / update the legal text",
      security: bearer,
      description: `${admin} Upsert: creates the single row if it does not exist. All three fields are required.`,
      requestBody: jsonBody(updateLegalSchema, {
        privacyPolicy: "Privacy policy text",
        termsCondition: "Terms and conditions text",
        aboutUs: "About us text",
      }),
      responses: {
        ...ok("Legal text saved", ref("Legal")),
        ...errors("400", "401", "403"),
      },
    },
  },
};

const notificationNote =
  "Notifications are created by the server (welcome, account blocked/activated, level unlocked, chapter completed) and pushed through Firebase FCM to the `fcmToken` saved at login.";

export const notificationPaths: Obj = {
  "/notifications/dummy": {
    post: {
      tags: ["Notification"],
      summary: "Create a test notification for yourself",
      security: bearer,
      description: `${both} Saves it and pushes it to your device. Every field is optional. ${notificationNote}`,
      requestBody: jsonBody(dummyNotificationZod, {
        message: "Test notification",
        description: "Hello from the dummy API",
        modelType: "Auth",
      }),
      responses: {
        ...ok("Notification created", ref("Notification"), "201"),
        ...errors("400", "401", "403"),
      },
    },
  },
  "/notifications": {
    get: {
      tags: ["Notification"],
      summary: "List my notifications",
      security: bearer,
      description: `${both} Newest first. \`meta.total\` follows the filter; \`meta.unreadCount\` is always the number of all unread notifications.`,
      parameters: [
        ...paginationParams(10),
        queryParam("read", "Filter by read state", {
          type: "string",
          enum: ["true", "false"],
        }),
      ],
      responses: {
        ...ok("Notifications", {
          type: "object",
          properties: {
            meta: {
              allOf: [
                ref("PaginationMeta"),
                {
                  type: "object",
                  properties: { unreadCount: { type: "integer" } },
                },
              ],
            },
            notifications: arrayOf(ref("Notification")),
          },
        }),
        ...errors("401", "403"),
      },
    },
    delete: {
      tags: ["Notification"],
      summary: "Delete all my notifications",
      security: bearer,
      description: both,
      responses: {
        ...ok("Cleared", {
          type: "object",
          properties: { deletedCount: { type: "integer" } },
        }),
        ...errors("401", "403"),
      },
    },
  },
  "/notifications/read-all": {
    patch: {
      tags: ["Notification"],
      summary: "Mark all my unread notifications as read",
      security: bearer,
      description: both,
      responses: {
        ...ok("Marked as read", {
          type: "object",
          properties: { updatedCount: { type: "integer" } },
        }),
        ...errors("401", "403"),
      },
    },
  },
  "/notifications/{id}": {
    delete: {
      tags: ["Notification"],
      summary: "Delete one of my notifications",
      security: bearer,
      description: `${both} Another user's notification returns 404.`,
      parameters: [pathParam("id", "Notification id")],
      responses: {
        ...ok("Deleted"),
        ...errors("401", "403", "404"),
      },
    },
  },
};

const noAuthNote =
  "**No authentication is enforced on this route today** (see `uploadFile.routes.ts`), so anyone can call it.";

export const uploadPaths: Obj = {
  "/upload-files": {
    post: {
      tags: ["Upload"],
      summary: "Upload one file to S3",
      description: noAuthNote,
      requestBody: multipartBody({
        files: [{ name: "file", description: "The file", required: true }],
      }),
      responses: {
        ...ok("Uploaded", {
          type: "object",
          properties: { url: { type: "string" } },
        }),
      },
    },
    delete: {
      tags: ["Upload"],
      summary: "Delete one file from S3",
      description: noAuthNote,
      requestBody: jsonBody(z.object({ url: z.string().url() }), {
        url: "https://bucket.s3.region.amazonaws.com/dendalar/file.png",
      }),
      responses: { ...ok("Deleted") },
    },
  },
  "/upload-files/multiple": {
    post: {
      tags: ["Upload"],
      summary: "Upload several files to S3",
      description: noAuthNote,
      requestBody: multipartBody({
        files: [
          {
            name: "files",
            description: "One or more files",
            required: true,
            multiple: true,
          },
        ],
      }),
      responses: {
        ...ok("Uploaded", {
          type: "object",
          properties: { urls: { type: "array", items: { type: "string" } } },
        }),
      },
    },
    delete: {
      tags: ["Upload"],
      summary: "Delete several files from S3",
      description: noAuthNote,
      requestBody: jsonBody(z.object({ urls: z.array(z.string().url()) }), {
        urls: [
          "https://bucket.s3.region.amazonaws.com/dendalar/a.png",
          "https://bucket.s3.region.amazonaws.com/dendalar/b.png",
        ],
      }),
      responses: { ...ok("Deleted") },
    },
  },
};
