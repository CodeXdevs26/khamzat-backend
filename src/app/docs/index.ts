import { Application } from "express";
import swaggerUi from "swagger-ui-express";
import config from "../config";
import { components } from "./components";
import { Obj } from "./helpers";
import { adminPaths, authPaths, otpPaths } from "./paths.auth";
import {
  chapterPaths,
  lessonPaths,
  levelPaths,
  questionPaths,
} from "./paths.content";
import {
  legalPaths,
  mascotPaths,
  notificationPaths,
  profilePaths,
  uploadPaths,
} from "./paths.rest";

const spec: Obj = {
  openapi: "3.0.3",
  info: {
    title: "Dendalar API",
    version: "1.0.0",
    description:
      "Backend for the Dendalar language-learning app.\n\n" +
      "**Responses** are `{ success, message, data }`; errors are `{ success: false, message, error, stack? }`.\n\n" +
      "**Auth:** call `POST /auths/login`, then click **Authorize** and paste `data.accessToken`.\n\n" +
      "**Multipart endpoints** take their JSON fields as a string in the `payload` form field next to the file parts.",
  },
  servers: [{ url: "/api/v1", description: "Current server" }],
  tags: [
    { name: "Auth" },
    { name: "OTP" },
    { name: "Admin" },
    { name: "Profile" },
    { name: "Level" },
    { name: "Chapter" },
    { name: "Lesson" },
    { name: "Question" },
    { name: "Mascot" },
    { name: "Legal" },
    { name: "Notification" },
    { name: "Upload" },
  ],
  paths: {
    ...authPaths,
    ...otpPaths,
    ...adminPaths,
    ...profilePaths,
    ...levelPaths,
    ...chapterPaths,
    ...lessonPaths,
    ...questionPaths,
    ...mascotPaths,
    ...legalPaths,
    ...notificationPaths,
    ...uploadPaths,
  },
  components,
};

// Swagger UI is on by default except in production (set SWAGGER_ENABLED=true
// to expose it there).
export const isSwaggerEnabled = () =>
  config.env !== "production" || process.env.SWAGGER_ENABLED === "true";

export const mountSwagger = (app: Application) => {
  if (!isSwaggerEnabled()) return;

  app.get("/api-docs.json", (_req, res) => {
    res.json(spec);
  });
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "Dendalar API docs",
      swaggerOptions: { persistAuthorization: true },
    })
  );
};

export default spec;
