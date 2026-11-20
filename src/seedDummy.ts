/**
 * Inserts demo data into every table so the APIs can be tested end to end.
 *
 * - Additive and idempotent: it only creates rows that are missing and never
 *   updates or deletes existing data (the admin and your real content stay).
 * - Demo content is prefixed with "Demo" and uses level indexes 3 and 4.
 * - Demo users use @example.com emails and the password below.
 *
 * Run: npm run seed:dummy
 */
import bcrypt from "bcrypt";
import {
  LoginProvider,
  NotificationModelType,
  OTPPurpose,
  QuestionType,
  ReferralSource,
  UserPurpose,
  UserRole,
  UserStatus,
} from "@prisma/client";
import prisma from "./app/utils/prisma";

const DEMO_PASSWORD = "Demo@1234";
const DEMO_OTP = "123456";

const img = (label: string) =>
  `https://placehold.co/400x400/png?text=${encodeURIComponent(label)}`;

const seedContent = async () => {
  const levels = [
    { name: "Demo Beginner", index: 3 },
    { name: "Demo Intermediate", index: 4 },
  ];

  const levelRows = [];
  for (const level of levels) {
    const existing = await prisma.level.findFirst({
      where: { OR: [{ name: level.name }, { index: level.index }] },
    });
    levelRows.push(
      existing ??
        (await prisma.level.create({
          data: { ...level, image: img(level.name) },
        }))
    );
  }
  const [beginner, intermediate] = levelRows as [
    (typeof levelRows)[number],
    (typeof levelRows)[number],
  ];

  const chapters = [
    { level: beginner, index: 1, name: "Greetings", note: "Say hello" },
    { level: beginner, index: 2, name: "Numbers", note: "Count to ten" },
    { level: intermediate, index: 1, name: "Travel", note: "Get around" },
  ];

  const chapterRows = [];
  for (const chapter of chapters) {
    const existing = await prisma.chapter.findFirst({
      where: { levelId: chapter.level.id, index: chapter.index },
    });
    chapterRows.push(
      existing ??
        (await prisma.chapter.create({
          data: {
            levelId: chapter.level.id,
            index: chapter.index,
            name: chapter.name,
            note: chapter.note,
          },
        }))
    );
  }
  const [greetings, numbers, travel] = chapterRows as [
    (typeof chapterRows)[number],
    (typeof chapterRows)[number],
    (typeof chapterRows)[number],
  ];

  const lessons = [
    { chapter: greetings, index: 1, lessonType: QuestionType.SENTENCE },
    { chapter: greetings, index: 2, lessonType: QuestionType.DIALOGUE },
    { chapter: numbers, index: 1, lessonType: QuestionType.SENTENCE },
    { chapter: travel, index: 1, lessonType: QuestionType.SENTENCE },
  ];

  const lessonRows = [];
  for (const lesson of lessons) {
    const existing = await prisma.lesson.findFirst({
      where: { chapterId: lesson.chapter.id, index: lesson.index },
    });
    lessonRows.push(
      existing ??
        (await prisma.lesson.create({
          data: {
            chapterId: lesson.chapter.id,
            index: lesson.index,
            lessonType: lesson.lessonType,
          },
        }))
    );
  }
  const [greetSentence, greetDialogue, numbersSentence, travelSentence] =
    lessonRows as [
      (typeof lessonRows)[number],
      (typeof lessonRows)[number],
      (typeof lessonRows)[number],
      (typeof lessonRows)[number],
    ];

  const sentence = (en: string, learn: string, hint: string) => ({
    sentenceInEnglish: en,
    sentenceInLearningLanguage: learn,
    hint,
  });
  const dialogue = (fullSentence: string, missingWord: string) => ({
    fullSentence,
    missingWord,
  });

  const questions = [
    {
      lesson: greetSentence,
      chapter: greetings,
      type: QuestionType.SENTENCE,
      items: [
        sentence("Hello", "Hola", "A common greeting"),
        sentence("Good morning", "Buenos días", "Used before noon"),
        sentence("Thank you", "Gracias", "Said to show thanks"),
      ],
    },
    {
      lesson: greetDialogue,
      chapter: greetings,
      type: QuestionType.DIALOGUE,
      items: [
        dialogue("Hola, ¿cómo estás?", "cómo"),
        dialogue("Muy bien, gracias.", "gracias"),
      ],
    },
    {
      lesson: numbersSentence,
      chapter: numbers,
      type: QuestionType.SENTENCE,
      items: [
        sentence("One", "Uno", "The first number"),
        sentence("Two", "Dos", "Comes after one"),
        sentence("Three", "Tres", "Comes after two"),
      ],
    },
    {
      lesson: travelSentence,
      chapter: travel,
      type: QuestionType.SENTENCE,
      items: [
        sentence(
          "Where is the station?",
          "¿Dónde está la estación?",
          "Ask for a place"
        ),
        sentence(
          "One ticket, please",
          "Un billete, por favor",
          "Buying a ticket"
        ),
      ],
    },
  ];

  const questionRows = [];
  for (const group of questions) {
    for (const [i, item] of group.items.entries()) {
      const index = i + 1;
      const existing = await prisma.question.findFirst({
        where: {
          chapterId: group.chapter.id,
          lessonId: group.lesson.id,
          index,
          type: group.type,
        },
      });
      questionRows.push(
        existing ??
          (await prisma.question.create({
            data: {
              chapterId: group.chapter.id,
              lessonId: group.lesson.id,
              index,
              type: group.type,
              ...item,
            },
          }))
      );
    }
  }

  return {
    beginner,
    greetings,
    greetSentence,
    firstQuestion: questionRows[0]!,
    counts: {
      levels: levelRows.length,
      chapters: chapterRows.length,
      lessons: lessonRows.length,
      questions: questionRows.length,
    },
  };
};

const seedUsers = async (content: Awaited<ReturnType<typeof seedContent>>) => {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1) ACTIVE learner already part-way through the demo content
  const activeEmail = "demo.user1@example.com";
  let active = await prisma.auth.findUnique({ where: { email: activeEmail } });
  if (!active) {
    active = await prisma.auth.create({
      data: {
        email: activeEmail,
        password,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        loginProvider: LoginProvider.EMAIL,
        profile: { create: { name: "Demo User One", image: "" } },
        userProfile: {
          create: {
            purpose: UserPurpose.JUST_FOR_FUN,
            referralSource: ReferralSource.INSTAGRAM,
            age: 24,
            activeLevelId: content.beginner.id,
            activeChapterId: content.greetings.id,
            activeLessonId: content.greetSentence.id,
            activeQuestionId: content.firstQuestion.id,
          },
        },
      },
    });
  }

  // 2) brand-new ACTIVE learner with no progress yet
  const freshEmail = "demo.user2@example.com";
  if (!(await prisma.auth.findUnique({ where: { email: freshEmail } }))) {
    await prisma.auth.create({
      data: {
        email: freshEmail,
        password,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        loginProvider: LoginProvider.EMAIL,
        profile: { create: { name: "Demo User Two", image: "" } },
        userProfile: {
          create: {
            purpose: UserPurpose.BOOST_CAREER,
            referralSource: ReferralSource.FACEBOOK,
            age: 31,
          },
        },
      },
    });
  }

  // 3) PENDING learner with a live OTP, to test verification (and the
  //    welcome notification that follows it)
  const pendingEmail = "demo.pending@example.com";
  if (!(await prisma.auth.findUnique({ where: { email: pendingEmail } }))) {
    await prisma.auth.create({
      data: {
        email: pendingEmail,
        password,
        role: UserRole.USER,
        status: UserStatus.PENDING,
        loginProvider: LoginProvider.EMAIL,
        profile: { create: { name: "Demo Pending", image: "" } },
        userProfile: {
          create: {
            purpose: UserPurpose.HIGHER_EDUCATION,
            referralSource: ReferralSource.TIKTOK,
          },
        },
        otp: {
          create: {
            otp: await bcrypt.hash(DEMO_OTP, 10),
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            purpose: OTPPurpose.VERIFY_ACCOUNT,
          },
        },
      },
    });
  }

  return active;
};

const seedNotifications = async (
  receiverId: string,
  content: Awaited<ReturnType<typeof seedContent>>
) => {
  if ((await prisma.notification.count({ where: { receiverId } })) > 0) return;

  const now = Date.now();
  await prisma.notification.createMany({
    data: [
      {
        receiverId,
        message: "Welcome to Dendalar!",
        description: "Your account is verified. Start learning now.",
        modelType: NotificationModelType.Auth,
        referenceId: receiverId,
        read: true,
        createdAt: new Date(now - 3 * 60 * 60 * 1000),
      },
      {
        receiverId,
        message: "Chapter completed!",
        description: "Chapter 1: Greetings is unlocked.",
        modelType: NotificationModelType.Chapter,
        referenceId: content.greetings.id,
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        receiverId,
        message: "Level 3 unlocked!",
        description: "Demo Beginner is now open.",
        modelType: NotificationModelType.Level,
        referenceId: content.beginner.id,
        createdAt: new Date(now - 60 * 60 * 1000),
      },
    ],
  });
};

const seedMascotAndLegal = async () => {
  if (!(await prisma.mascot.findUnique({ where: { key: "default" } }))) {
    await prisma.mascot.create({
      data: {
        key: "default",
        splash1: img("splash1"),
        splash2: img("splash2"),
        splash3: img("splash3"),
        login: img("login"),
        signupSuccess: img("signupSuccess"),
        levelLocked: img("levelLocked"),
        congrats: img("congrats"),
        hint: img("hint"),
      },
    });
  }

  if (!(await prisma.legal.findFirst())) {
    await prisma.legal.create({
      data: {
        privacyPolicy: "Demo privacy policy. Replace with the real text.",
        termsCondition:
          "Demo terms and conditions. Replace with the real text.",
        aboutUs: "Demo about us. Replace with the real text.",
      },
    });
  }
};

const main = async () => {
  const content = await seedContent();
  const demoUser = await seedUsers(content);
  await seedNotifications(demoUser.id, content);
  await seedMascotAndLegal();

  console.log("Demo data ready:", content.counts);
  console.log(
    `Demo logins: demo.user1@example.com | demo.user2@example.com | demo.pending@example.com  (password ${DEMO_PASSWORD}, pending OTP ${DEMO_OTP})`
  );
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
