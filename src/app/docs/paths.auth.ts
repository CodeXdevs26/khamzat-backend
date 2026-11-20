import {
  changeAccountStatusZod,
  changePasswordZod,
  loginZodSchema,
  resetPasswordZod,
  userSignUpZod,
} from "../modules/auth/auth.validation";
import { verifyOtpZod } from "../modules/otp/otp.validation";
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
import { profileUpdateZod } from "../modules/admin/admin.validation";
import { z } from "zod";

const adminOnly = "Role: **ADMIN**.";

export const authPaths: Obj = {
  "/auths/signup": {
    post: {
      tags: ["Auth"],
      summary: "Sign up a learner",
      description:
        "Creates the account in `PENDING` status and emails a 6-digit OTP (valid 2 minutes). Verify it with `POST /otps/verify` (purpose `VERIFY_ACCOUNT`) to activate the account. Only the `USER` role can sign up.",
      requestBody: jsonBody(userSignUpZod, {
        email: "learner@example.com",
        password: "Demo@1234",
        name: "Demo Learner",
        role: "USER",
        purpose: "JUST_FOR_FUN",
        referralSource: "INSTAGRAM",
        age: 24,
      }),
      responses: {
        ...ok("Account created, OTP sent", ref("Auth"), "201"),
        ...errors("400"),
      },
    },
  },
  "/auths/login": {
    post: {
      tags: ["Auth"],
      summary: "Log in with email and password",
      description:
        "Returns an access token and also sets the `dendalarRefreshToken` httpOnly cookie. If `fcmToken` is sent it is saved on this account on every login (and removed from any other account that had it). With `isMobileApp: true` the access token lives as long as the refresh token.",
      requestBody: jsonBody(loginZodSchema, {
        email: "demo.user1@example.com",
        password: "Demo@1234",
        fcmToken: "<device FCM token>",
        isMobileApp: true,
      }),
      responses: {
        ...ok("Logged in", {
          type: "object",
          properties: { accessToken: { type: "string" } },
        }),
        ...errors("400", "404"),
      },
    },
  },
  "/auths/refresh-token": {
    get: {
      tags: ["Auth"],
      summary: "Get a new access token from the refresh cookie",
      description: "Reads the `dendalarRefreshToken` cookie.",
      responses: {
        ...ok("New access token", {
          type: "object",
          properties: { accessToken: { type: "string" } },
        }),
        ...errors("401"),
      },
    },
  },
  "/auths/reset-password": {
    post: {
      tags: ["Auth"],
      summary: "Set a new password after OTP verification",
      description:
        "Flow: `POST /otps/send` (purpose `RESET_PASSWORD`) → `POST /otps/verify` returns a `resetToken` (valid 10 minutes) → this call.",
      requestBody: jsonBody(resetPasswordZod, {
        email: "learner@example.com",
        password: "NewPass@123",
        resetToken: "<token from /otps/verify>",
      }),
      responses: { ...ok("Password reset"), ...errors("400", "401", "404") },
    },
  },
  "/auths/change-password": {
    post: {
      tags: ["Auth"],
      summary: "Change own password",
      security: bearer,
      description: "Roles: **ADMIN**, **USER**.",
      requestBody: jsonBody(changePasswordZod, {
        oldPassword: "Demo@1234",
        newPassword: "NewPass@123",
      }),
      responses: {
        ...ok("Password changed"),
        ...errors("400", "401", "403"),
      },
    },
  },
  "/auths/delete-account": {
    delete: {
      tags: ["Auth"],
      summary: "Delete own account",
      security: bearer,
      description:
        "Roles: **ADMIN**, **USER**. Hard-deletes the account and everything linked to it (profile, progress, OTP, notifications) and removes the profile image from S3. Admin accounts cannot be deleted here. Clears the refresh cookie.",
      responses: { ...ok("Account deleted"), ...errors("400", "401", "403") },
    },
  },
  "/auths/logout": {
    post: {
      tags: ["Auth"],
      summary: "Log out",
      security: bearer,
      description:
        "Roles: **ADMIN**, **USER**. Clears the refresh cookie and sets the account's `fcmToken` to `null` so no more pushes reach this device.",
      responses: { ...ok("Logged out"), ...errors("401", "403") },
    },
  },
  "/auths": {
    get: {
      tags: ["Auth"],
      summary: "List users",
      security: bearer,
      description: `${adminOnly} Returns \`ACTIVE\` and \`BLOCKED\` learners only, newest first by default.`,
      parameters: [
        ...paginationParams(10),
        queryParam("searchTerm", "Matches email or profile name"),
        queryParam("role", "Comma separated roles, e.g. `USER`"),
      ],
      responses: {
        ...ok("Users", {
          type: "object",
          properties: {
            meta: ref("PaginationMeta"),
            auths: arrayOf(ref("AuthListItem")),
          },
        }),
        ...errors("401", "403"),
      },
    },
  },
  "/auths/{id}": {
    get: {
      tags: ["Auth"],
      summary: "Get one user",
      security: bearer,
      description: adminOnly,
      parameters: [pathParam("id", "Auth id")],
      responses: {
        ...ok("User", ref("AuthSingle")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/auths/change-account-status/{userId}": {
    patch: {
      tags: ["Auth"],
      summary: "Block, activate or delete-flag a user",
      security: bearer,
      description: `${adminOnly} Admin accounts cannot be changed. Moving to \`BLOCKED\` or \`ACTIVE\` sends the user a push notification.`,
      parameters: [pathParam("userId", "Auth id of the user")],
      requestBody: jsonBody(changeAccountStatusZod, { status: "BLOCKED" }),
      responses: {
        ...ok("Status changed"),
        ...errors("400", "401", "403", "404"),
      },
    },
  },
};

export const otpPaths: Obj = {
  "/otps/send": {
    post: {
      tags: ["OTP"],
      summary: "Send an OTP email",
      description:
        "Creates (or replaces) the user's OTP, valid 5 minutes. `purpose` defaults to `VERIFY_ACCOUNT` when missing or unknown.",
      requestBody: jsonBody(
        z.object({
          email: z.string().email(),
          purpose: z.enum(["VERIFY_ACCOUNT", "RESET_PASSWORD"]).optional(),
        }),
        { email: "learner@example.com", purpose: "RESET_PASSWORD" }
      ),
      responses: { ...ok("OTP sent"), ...errors("404") },
    },
  },
  "/otps/verify": {
    post: {
      tags: ["OTP"],
      summary: "Verify an OTP",
      description:
        "`VERIFY_ACCOUNT`: activates the account, sends the welcome push, `data` is `null`. `RESET_PASSWORD`: `data.resetToken` is returned for `POST /auths/reset-password`. More than 3 wrong attempts blocks the code.",
      requestBody: jsonBody(verifyOtpZod, {
        email: "demo.pending@example.com",
        otp: "123456",
        purpose: "VERIFY_ACCOUNT",
      }),
      responses: {
        ...ok("OTP verified", {
          type: "object",
          nullable: true,
          properties: { resetToken: { type: "string" } },
        }),
        ...errors("400", "404"),
      },
    },
  },
};

export const adminPaths: Obj = {
  "/admins/profile": {
    get: {
      tags: ["Admin"],
      summary: "Get the admin's own profile",
      security: bearer,
      description: adminOnly,
      responses: {
        ...ok("Profile", ref("Profile")),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/admins/dashboard-stats": {
    get: {
      tags: ["Admin"],
      summary: "Dashboard totals and monthly user sign-ups",
      security: bearer,
      description: adminOnly,
      parameters: [
        queryParam(
          "year",
          "Year for the monthly overview (default: this year)",
          {
            type: "integer",
            example: 2026,
          }
        ),
      ],
      responses: {
        ...ok("Stats", {
          type: "object",
          properties: {
            stats: {
              type: "object",
              properties: {
                totalUsers: { type: "integer" },
                totalLevels: { type: "integer" },
                totalLessons: { type: "integer" },
              },
            },
            userOverview: arrayOf({
              type: "object",
              properties: {
                month: { type: "string", example: "january" },
                users: { type: "integer" },
              },
            }),
          },
        }),
        ...errors("401", "403"),
      },
    },
  },
  "/admins": {
    patch: {
      tags: ["Admin"],
      summary: "Update the admin's name and/or image",
      security: bearer,
      description: `${adminOnly} Multipart. A new image replaces (and deletes) the old one on S3.`,
      requestBody: multipartBody({
        payload: profileUpdateZod,
        payloadExample: { name: "New Admin Name" },
        payloadRequired: false,
        files: [{ name: "image", description: "Profile image" }],
      }),
      responses: {
        ...ok("Profile updated", ref("Profile")),
        ...errors("400", "401", "403"),
      },
    },
  },
};
