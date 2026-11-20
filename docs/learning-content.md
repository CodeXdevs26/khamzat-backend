# Learning content: Level, Chapter, Lesson, Question

This explains how the four content modules connect, how a learner's progress
is stored, and how locked/completed flags are worked out.

Code: `src/app/modules/{level,chapter,lesson,question}` and
`src/app/modules/profile` (progress). Schema: `prisma/schema.prisma`.

## 1. Hierarchy

```
Level            (index, unique across the app)
 └─ Chapter      (index, unique inside its level)
     └─ Lesson   (index, unique inside its chapter; type SENTENCE | DIALOGUE)
         └─ Question (index; type copied from its lesson)
```

| Model    | Parent  | Key rules                                                                                                                                                                                                |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Level    | none    | `name` and `index` are both unique. Has an `image` (uploaded to S3 by the admin).                                                                                                                        |
| Chapter  | Level   | `@@unique([levelId, index])`. Optional `note`.                                                                                                                                                           |
| Lesson   | Chapter | `@@unique([index, chapterId])`. `lessonType` is `SENTENCE` or `DIALOGUE`.                                                                                                                                |
| Question | Lesson  | Also stores `chapterId` directly. `type` is copied from the lesson. `@@unique([index, type, chapterId, lessonId])`. Optional `audio` (S3). Deleting a lesson keeps its questions with `lessonId = null`. |

Deleting a Level, Chapter or Lesson cascades to the children below it (Level →
Chapters → Lessons → Questions). A Lesson delete is the exception for
Questions: they stay, with `lessonId` set to null.

### Question fields depend on the type

| Type       | Required fields                                           |
| ---------- | --------------------------------------------------------- |
| `SENTENCE` | `sentenceInEnglish`, `sentenceInLearningLanguage`, `hint` |
| `DIALOGUE` | `fullSentence`, `missingWord`                             |

The service checks this against the lesson's `lessonType` on create and update.

## 2. Admin flow: build the content top-down

All write routes are `ADMIN` only. Create in this order, because each step needs
the id from the previous one:

1. `POST /api/v1/levels` — multipart: `image` file + `payload` JSON `{ name, index }`
2. `POST /api/v1/chapters` — JSON `{ levelId, name, index, note? }`
3. `POST /api/v1/lessons` — JSON `{ chapterId, index, lessonType }`
4. `POST /api/v1/questions` — multipart: optional `audio` file + `payload` JSON
   `{ chapterId, lessonId, index, ...type fields }`

Reads (`GET`) are open to `ADMIN` and `USER`:

| Endpoint                                       | Returns                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `GET /levels`                                  | all levels, ordered by `index`                                 |
| `GET /chapters?levelId=`                       | chapters (with their `level` and `lessons`)                    |
| `GET /lessons?chapterId=`                      | lessons (with their `chapter`)                                 |
| `GET /questions?lessonId=`                     | paged questions, default 7 per page (admin listing)            |
| `GET /questions/lesson/:lessonId?page=&limit=` | paged questions of one lesson, with `isCompleted` for learners |

For a `USER`, Level, Chapter and Lesson responses are decorated with
`isCompleted` and `isLocked`; questions get `isCompleted` only.

## 3. Learner progress

Progress is four pointers on `UserProfile`. There is no per-item completion
table:

```
activeLevelId  activeChapterId  activeLessonId  activeQuestionId
```

All four are nullable and use `onDelete: SetNull`, so deleting content clears
the pointer instead of the profile.

The app moves the pointers forward with `PATCH /api/v1/profile/...` (role `USER`):

| Endpoint           | Body             | Effect                                                            |
| ------------------ | ---------------- | ----------------------------------------------------------------- |
| `/active-level`    | none             | moves to the next level (by `index + 1`)                          |
| `/active-chapter`  | `{ chapterId }`  | next chapter in the level, or the first chapter of the next level |
| `/active-lesson`   | `{ lessonId }`   | next lesson; rolls over into the next chapter / level when needed |
| `/active-question` | `{ questionId }` | next question; rolls over into the next lesson / chapter / level  |
| `/reset-level`     | none             | resets all four pointers to the very first question               |

The body id is the item the learner just **finished**. The server writes the
**next** item, and always updates the parent pointers as well (a rollover into
a new chapter also updates `activeChapterId` and `activeLevelId`).

"Next" is decided by `index` at each level (questions use `index`, then
`createdAt` as tie-breaker).

## 4. How `isCompleted` / `isLocked` are computed

Computed on read, by comparing each item to the learner's pointers:

- **No progress yet** (no `activeLevelId`): only the first level, its first
  chapter and its first lesson are unlocked.
- **Earlier than the pointer** (lower level index, lower chapter index in the
  same level, lower lesson index in the same chapter): `isCompleted = true`,
  `isLocked = false`.
- **Equal to the pointer:** unlocked, not completed.
- **Later than the pointer:** `isLocked = true`.
- A question is `isCompleted` when it sits before `activeQuestionId` in the
  lesson's ordering, or when its lesson/chapter/level is already behind the
  learner.

## 5. Notifications on progress

After a progress update, `notifyProgressChange` in `profile.service.ts` compares
the old and new pointers and sends **one** push at most:

1. level changed → "Level N unlocked!" (`modelType: Level`)
2. otherwise chapter changed → "Chapter completed!" (`modelType: Chapter`)

Lesson and question changes never notify. `reset-level` never notifies.

## 6. Demo data

`npm run seed:dummy` adds two demo levels (index 3 and 4) with chapters,
lessons and questions, plus demo users, a mascot row, legal text and a few
notifications. It only inserts missing rows and never edits existing data.
