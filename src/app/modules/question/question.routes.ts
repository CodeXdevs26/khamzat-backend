import { Router } from "express";
import { questionController } from "./question.controller";
import authorize from "../../middlewares/authorize";
import { UserRole } from "@prisma/client";
import validate from "../../middlewares/validate";
import { createQuestionZod, updateQuestionZod } from "./question.validation";
import { uploadAudio } from "../../utils/awss3";

const router = Router();

router.post(
  "/",
  authorize(UserRole.ADMIN),
  uploadAudio.single("audio"),
  validate(createQuestionZod, { formData: true }),
  questionController.createQuestion
);

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.USER),
  questionController.getAllQuestions
);

router.get(
  "/lesson/:lessonId",
  authorize(UserRole.ADMIN, UserRole.USER),
  questionController.getQuestionsByLesson
);

router.patch(
  "/:id",
  authorize(UserRole.ADMIN),
  uploadAudio.single("audio"),
  validate(updateQuestionZod, { formData: true }),
  questionController.updateQuestion
);

router.delete(
  "/:id",
  authorize(UserRole.ADMIN),
  questionController.deleteQuestion
);

export const questionRoutes = router;
