import { mascotFieldNames } from "../modules/mascot/mascot.validation";
import { arrayOf, Obj, ref } from "./helpers";

const str: Obj = { type: "string" };
const id: Obj = { type: "string", format: "uuid" };
const date: Obj = { type: "string", format: "date-time" };
const nullableStr: Obj = { type: "string", nullable: true };
const nullableId: Obj = { type: "string", format: "uuid", nullable: true };
const int: Obj = { type: "integer" };

const object = (properties: Obj, description?: string): Obj => ({
  type: "object",
  ...(description ? { description } : {}),
  properties,
});

const progressFlags: Obj = {
  isCompleted: {
    type: "boolean",
    description: "Only present for the USER role",
  },
  isLocked: {
    type: "boolean",
    description: "Only present for the USER role (not on questions)",
  },
};

export const components: Obj = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Access token from `POST /auths/login` (`data.accessToken`). Paste only the token; Swagger adds `Bearer `.",
    },
  },
  schemas: {
    Error: object({
      success: { type: "boolean", example: false },
      message: str,
      error: { description: "Error details (shape varies)" },
      stack: { type: "string", description: "Only outside production" },
    }),
    PaginationMeta: object({
      page: int,
      limit: int,
      total: int,
    }),
    Auth: object({
      id,
      email: str,
      role: { type: "string", enum: ["ADMIN", "USER"] },
      status: {
        type: "string",
        enum: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"],
      },
      loginProvider: { type: "string", enum: ["EMAIL", "GOOGLE"] },
      createdAt: date,
      updatedAt: date,
    }),
    AuthListItem: object({
      id,
      email: str,
      role: { type: "string", enum: ["ADMIN", "USER"] },
      status: { type: "string", enum: ["ACTIVE", "BLOCKED"] },
      createdAt: date,
      profile: object({ name: str, image: str }),
    }),
    AuthSingle: object({
      id,
      createdAt: date,
      profile: object({ name: str, image: str }),
    }),
    Profile: object({
      id,
      authId: id,
      name: str,
      image: { type: "string", description: "S3 URL, empty if none" },
      createdAt: date,
      updatedAt: date,
    }),
    ProfileWithAuth: {
      allOf: [
        ref("Profile"),
        object({
          auth: object({
            email: str,
            status: str,
            role: str,
          }),
        }),
      ],
    },
    UserProfile: object({
      id,
      authId: id,
      purpose: {
        type: "string",
        enum: [
          "JUST_FOR_FUN",
          "BOOST_CAREER",
          "CONNECT_WITH_PEOPLE",
          "HIGHER_EDUCATION",
          "OTHER",
        ],
      },
      referralSource: {
        type: "string",
        enum: ["FACEBOOK", "INSTAGRAM", "TIKTOK", "OTHER"],
      },
      age: { type: "integer", nullable: true },
      activeLevelId: nullableId,
      activeChapterId: nullableId,
      activeLessonId: nullableId,
      activeQuestionId: nullableId,
      createdAt: date,
      updatedAt: date,
    }),
    Level: object({
      id,
      name: str,
      index: int,
      image: { type: "string", description: "S3 URL" },
      createdAt: date,
      updatedAt: date,
      ...progressFlags,
    }),
    Chapter: object({
      id,
      name: str,
      index: int,
      note: nullableStr,
      levelId: id,
      createdAt: date,
      updatedAt: date,
      level: object({ id, name: str, index: int }),
      lessons: arrayOf(ref("Lesson")),
      ...progressFlags,
    }),
    Lesson: object({
      id,
      index: int,
      lessonType: { type: "string", enum: ["SENTENCE", "DIALOGUE"] },
      chapterId: id,
      chapter: object({ id, name: str, index: int, levelId: id }),
      ...progressFlags,
    }),
    Question: object({
      id,
      chapterId: id,
      lessonId: nullableId,
      index: int,
      type: { type: "string", enum: ["SENTENCE", "DIALOGUE"] },
      sentenceInEnglish: nullableStr,
      sentenceInLearningLanguage: nullableStr,
      hint: nullableStr,
      fullSentence: nullableStr,
      missingWord: nullableStr,
      audio: { type: "string", nullable: true, description: "S3 URL" },
      createdAt: date,
      updatedAt: date,
      isCompleted: {
        type: "boolean",
        description: "Only on GET /questions/lesson/{lessonId} for USER",
      },
    }),
    Mascot: object(
      {
        id,
        key: { type: "string", example: "default" },
        ...Object.fromEntries(
          mascotFieldNames.map(name => [name, nullableStr])
        ),
        createdAt: date,
        updatedAt: date,
      },
      "Each image field is an S3 URL or null."
    ),
    Legal: object({
      id,
      privacyPolicy: str,
      termsCondition: str,
      aboutUs: str,
      updatedAt: date,
    }),
    Notification: object({
      id,
      receiverId: id,
      message: { type: "string", description: "Push title" },
      description: { type: "string", nullable: true, description: "Push body" },
      modelType: { type: "string", enum: ["Auth", "Level", "Chapter"] },
      referenceId: {
        type: "string",
        nullable: true,
        description: "Id of the Auth / Level / Chapter row it refers to",
      },
      read: { type: "boolean" },
      createdAt: date,
    }),
  },
};
