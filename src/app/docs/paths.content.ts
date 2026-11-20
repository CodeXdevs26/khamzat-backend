import {
  createChapterZod,
  updateChapterZod,
} from "../modules/chapter/chapter.validation";
import {
  createLessonZod,
  updateLessonInputZod,
} from "../modules/lesson/lesson.validation";
import {
  createLevelZod,
  updateLevelZod,
} from "../modules/level/level.validation";
import {
  createQuestionZod,
  updateQuestionZod,
} from "../modules/question/question.validation";
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
const progressNote =
  " For a `USER` every item also has `isCompleted` and `isLocked`, worked out from the learner's active pointers (see docs/learning-content.md).";

export const levelPaths: Obj = {
  "/levels": {
    post: {
      tags: ["Level"],
      summary: "Create a level",
      security: bearer,
      description: `${admin} Multipart. \`name\` and \`index\` must both be unique across levels. The image is required and uploaded to S3.`,
      requestBody: multipartBody({
        payload: createLevelZod,
        payloadExample: { name: "Beginner", index: 3 },
        files: [{ name: "image", description: "Level image", required: true }],
      }),
      responses: {
        ...ok("Level created", ref("Level"), "201"),
        ...errors("400", "401", "403"),
      },
    },
    get: {
      tags: ["Level"],
      summary: "List all levels",
      security: bearer,
      description: `${both} Ordered by \`index\`.${progressNote}`,
      responses: {
        ...ok("Levels", arrayOf(ref("Level"))),
        ...errors("401", "403"),
      },
    },
  },
  "/levels/{id}": {
    patch: {
      tags: ["Level"],
      summary: "Update a level",
      security: bearer,
      description: `${admin} Multipart. Send any of \`name\`, \`index\` (in \`payload\`) and/or a new \`image\` (replaces and deletes the old S3 file).`,
      parameters: [pathParam("id", "Level id")],
      requestBody: multipartBody({
        payload: updateLevelZod,
        payloadExample: { name: "Beginner 2" },
        payloadRequired: false,
        files: [{ name: "image", description: "New level image" }],
      }),
      responses: {
        ...ok("Level updated", ref("Level")),
        ...errors("400", "401", "403", "404"),
      },
    },
    delete: {
      tags: ["Level"],
      summary: "Delete a level",
      security: bearer,
      description: `${admin} Cascades to its chapters, lessons and questions; learners pointing at it get their pointer cleared. Removes the image from S3.`,
      parameters: [pathParam("id", "Level id")],
      responses: {
        ...ok("Level deleted", ref("Level")),
        ...errors("401", "403", "404"),
      },
    },
  },
};

export const chapterPaths: Obj = {
  "/chapters": {
    post: {
      tags: ["Chapter"],
      summary: "Create a chapter",
      security: bearer,
      description: `${admin} \`index\` must be unique inside the level.`,
      requestBody: jsonBody(createChapterZod, {
        levelId: "<level id>",
        name: "Greetings",
        index: 1,
        note: "Say hello",
      }),
      responses: {
        ...ok("Chapter created", ref("Chapter"), "201"),
        ...errors("400", "401", "403", "404"),
      },
    },
    get: {
      tags: ["Chapter"],
      summary: "List chapters (with their level and lessons)",
      security: bearer,
      description: `${both} Ordered by \`index\`.${progressNote} Lessons inside each chapter get the same flags.`,
      parameters: [queryParam("levelId", "Only chapters of this level")],
      responses: {
        ...ok("Chapters", arrayOf(ref("Chapter"))),
        ...errors("401", "403"),
      },
    },
  },
  "/chapters/{id}": {
    patch: {
      tags: ["Chapter"],
      summary: "Update a chapter",
      security: bearer,
      description: `${admin} The chapter cannot be moved to another level.`,
      parameters: [pathParam("id", "Chapter id")],
      requestBody: jsonBody(updateChapterZod, {
        name: "Greetings 2",
        index: 2,
        note: "Updated note",
      }),
      responses: {
        ...ok("Chapter updated", ref("Chapter")),
        ...errors("400", "401", "403", "404"),
      },
    },
    delete: {
      tags: ["Chapter"],
      summary: "Delete a chapter",
      security: bearer,
      description: `${admin} Cascades to its lessons and questions.`,
      parameters: [pathParam("id", "Chapter id")],
      responses: {
        ...ok("Chapter deleted", ref("Chapter")),
        ...errors("401", "403", "404"),
      },
    },
  },
};

export const lessonPaths: Obj = {
  "/lessons": {
    post: {
      tags: ["Lesson"],
      summary: "Create a lesson",
      security: bearer,
      description: `${admin} \`index\` must be unique inside the chapter. \`lessonType\` decides which question fields are required.`,
      requestBody: jsonBody(createLessonZod, {
        chapterId: "<chapter id>",
        index: 1,
        lessonType: "SENTENCE",
      }),
      responses: {
        ...ok("Lesson created", ref("Lesson"), "201"),
        ...errors("400", "401", "403", "404"),
      },
    },
    get: {
      tags: ["Lesson"],
      summary: "List lessons",
      security: bearer,
      description: `${both}${progressNote}`,
      parameters: [queryParam("chapterId", "Only lessons of this chapter")],
      responses: {
        ...ok("Lessons", arrayOf(ref("Lesson"))),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/lessons/{id}": {
    patch: {
      tags: ["Lesson"],
      summary: "Update a lesson",
      security: bearer,
      description: admin,
      parameters: [pathParam("id", "Lesson id")],
      requestBody: jsonBody(updateLessonInputZod, {
        index: 2,
        lessonType: "DIALOGUE",
      }),
      responses: {
        ...ok("Lesson updated", ref("Lesson")),
        ...errors("400", "401", "403", "404"),
      },
    },
    delete: {
      tags: ["Lesson"],
      summary: "Delete a lesson",
      security: bearer,
      description: `${admin} Its questions are kept but lose their lesson (\`lessonId\` becomes null).`,
      parameters: [pathParam("id", "Lesson id")],
      responses: {
        ...ok("Lesson deleted", ref("Lesson")),
        ...errors("401", "403", "404"),
      },
    },
  },
};

const questionFieldsNote =
  "Required fields depend on the lesson's type: `SENTENCE` needs `sentenceInEnglish`, `sentenceInLearningLanguage` and `hint`; `DIALOGUE` needs `fullSentence` and `missingWord`. Unknown fields are rejected.";

export const questionPaths: Obj = {
  "/questions": {
    post: {
      tags: ["Question"],
      summary: "Create a question",
      security: bearer,
      description: `${admin} Multipart. ${questionFieldsNote} The question \`type\` is copied from its lesson. \`audio\` is uploaded to S3.`,
      requestBody: multipartBody({
        payload: createQuestionZod,
        payloadExample: {
          chapterId: "<chapter id>",
          lessonId: "<lesson id>",
          index: 1,
          sentenceInEnglish: "Hello",
          sentenceInLearningLanguage: "Hola",
          hint: "A common greeting",
        },
        files: [{ name: "audio", description: "Optional audio file" }],
      }),
      responses: {
        ...ok("Question created", ref("Question"), "201"),
        ...errors("400", "401", "403", "404"),
      },
    },
    get: {
      tags: ["Question"],
      summary: "List questions (admin view)",
      security: bearer,
      description: `${both} Paged, ordered by \`index\`. Includes the chapter and lesson summary.`,
      parameters: [
        ...paginationParams(7),
        queryParam("lessonId", "Only questions of this lesson"),
      ],
      responses: {
        ...ok("Questions", {
          type: "object",
          properties: {
            meta: ref("PaginationMeta"),
            questions: arrayOf(ref("Question")),
          },
        }),
        ...errors("401", "403"),
      },
    },
  },
  "/questions/lesson/{lessonId}": {
    get: {
      tags: ["Question"],
      summary: "List the questions of one lesson",
      security: bearer,
      description: `${both} Paged. For a \`USER\` each question also has \`isCompleted\`.`,
      parameters: [pathParam("lessonId", "Lesson id"), ...paginationParams(7)],
      responses: {
        ...ok("Questions", {
          type: "object",
          properties: {
            meta: ref("PaginationMeta"),
            questions: arrayOf(ref("Question")),
          },
        }),
        ...errors("401", "403", "404"),
      },
    },
  },
  "/questions/{id}": {
    patch: {
      tags: ["Question"],
      summary: "Update a question",
      security: bearer,
      description: `${admin} Multipart. ${questionFieldsNote} A new \`audio\` replaces (and deletes) the old S3 file.`,
      parameters: [pathParam("id", "Question id")],
      requestBody: multipartBody({
        payload: updateQuestionZod,
        payloadExample: { sentenceInEnglish: "Hi", hint: "Informal greeting" },
        payloadRequired: false,
        files: [{ name: "audio", description: "New audio file" }],
      }),
      responses: {
        ...ok("Question updated", ref("Question")),
        ...errors("400", "401", "403", "404"),
      },
    },
    delete: {
      tags: ["Question"],
      summary: "Delete a question",
      security: bearer,
      description: `${admin} Removes its audio from S3.`,
      parameters: [pathParam("id", "Question id")],
      responses: {
        ...ok("Question deleted", ref("Question")),
        ...errors("401", "403", "404"),
      },
    },
  },
};
