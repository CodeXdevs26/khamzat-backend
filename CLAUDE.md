# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dendalar is the backend for a language-learning app (mobile clients plus an admin dashboard). It is built with Express 4, TypeScript, Prisma 7 and PostgreSQL. Prisma uses the `@prisma/adapter-pg` driver adapter over a `pg` Pool. Request validation uses Zod 4, and file storage uses AWS S3.

## Commands

```bash
docker compose up -d          # local Postgres 16 (postgres/postgres, db "dendalar", port 5432)
npm run dev                   # ts-node-dev with respawn, entry src/server.ts
npm run build                 # prisma generate && tsc -> dist/
npm start                     # node dist/server.js
npm run seed:admin            # create the ADMIN user from ADMIN_EMAIL / ADMIN_PASSWORD
npm run lint | lint:fix       # ESLint (flat config, eslint.config.mjs)
npm run format | format:check # Prettier

npx prisma migrate dev --name <name>   # create and apply a migration after editing prisma/schema.prisma
npx prisma generate                    # regenerate the client (also runs on postinstall)
```

There is no test suite.

Copy `.env.example` to `.env`. Config is loaded in [src/app/config/index.ts](src/app/config/index.ts). [prisma.config.ts](prisma.config.ts) reads the datasource URL from that config, and `schema.prisma` has no `url`.

## Architecture

- [src/server.ts](src/server.ts) creates the HTTP server. [src/app/app.ts](src/app/app.ts) sets up the CORS allow-list, JSON parsing and cookie-parser, and mounts everything under `/api/v1`. `/health` is the liveness route.
- [src/app/routes/index.ts](src/app/routes/index.ts) is the central route table. To add a module, register its router here.
- Each module in `src/app/modules/<name>/` has four files: `*.routes.ts`, `*.controller.ts`, `*.service.ts` and `*.validation.ts`. Each one exports a single object, such as `questionController` or `questionServices`.
  - **Routes** chain the middleware: `authorize(...roles)`, then multer (if needed), then `validate(zodSchema)`, then the controller.
  - **Controllers** are wrapped in `handleAsyncRequest`. They take query options with `pick(req.query, ["page","limit","sortBy","orderBy"])`, call the service, and reply with `sendResponse(res, { status, message, data })`.
  - **Services** contain all business logic and Prisma calls. They throw `ApiError(status, message)` for expected failures.
- **Auth** is handled by [middlewares/authorize.ts](src/app/middlewares/authorize.ts). It reads a `Bearer` access JWT and sets `req.user` (`TAuthUser`: id, email, role). Pass `authorize({ optional: true }, ...roles)` to allow anonymous access. The refresh token is stored in the `dendalarRefreshToken` cookie (see the auth module). Roles are `ADMIN` and `USER`. A user's `status` can be `PENDING`, `ACTIVE`, `BLOCKED` or `DELETED`, and signup and OTP verification depend on it.
- **Multipart requests** require `validate(schema, { formData: true })`. This JSON-parses `req.body.payload` and replaces `req.body` with the parsed result. Clients send JSON fields in a `payload` form field next to the file. Without `formData`, validation only checks `req.body` and does not change it.
- **Errors** go to [globalErrorHandler.ts](src/app/middlewares/globalErrorHandler.ts), which turns Prisma errors (P2002, P2003, P2025, validation), Zod, JWT and Multer errors into user-facing messages. This is why services usually let unique-constraint and FK errors propagate instead of checking for them first. The response shape is `{ success, message, error, stack? }`. Successful responses have the shape `{ success, message, data }`.
- **Files** are handled in [utils/awss3.ts](src/app/utils/awss3.ts). It provides the multer instances `upload`, `uploadImage` (jpeg, png or webp, 5MB max) and `uploadAudio`, which keep files in memory, plus `uploadToS3` and `deleteFromS3`. The usual pattern: upload first, run the DB write in a `try` block, and call `deleteFromS3` if the write fails. Also delete the old file from S3 when it is replaced.
- **Email** is sent by `utils/sendEmail.ts`, which fills `{{placeholders}}` in the HTML templates in `src/app/emailTemplates/` and POSTs them to an external `SEND_EMAIL_URL` service. Template paths are relative to the process cwd (`./src/app/emailTemplates/...`), and `tsc` does not copy them into `dist`.

## Domain model ([prisma/schema.prisma](prisma/schema.prisma))

- `Auth` holds credentials, role and status. It has a 1:1 relation to `Profile` (name, image) and `UserProfile` (learner onboarding data and progress pointers), and one `OTP` per purpose.
- The content hierarchy is `Level` → `Chapter` → `Lesson` → `Question`. Each has an `index`, with uniqueness scoped to its parent. A `Question` also points straight to its `Chapter`.
- `LessonType` and `QuestionType` are `SENTENCE` or `DIALOGUE`. A question's `type` is copied from its lesson's type, and the required fields depend on it: SENTENCE needs `sentenceInEnglish`, `sentenceInLearningLanguage` and `hint`, while DIALOGUE needs `fullSentence` and `missingWord`.
- A learner's progress is stored as `UserProfile.activeLevelId`, `activeChapterId`, `activeLessonId` and `activeQuestionId` (all `onDelete: SetNull`). There is no per-item completion table.
- `Mascot` is a single row (`key = "default"`) of image URLs for app screens. `Legal` holds the privacy policy, terms and about-us text.

Note: `stripe` and `socket.io` are dependencies, and `.env.example` lists Stripe variables, but nothing in `src` uses them yet.

## Conventions

- Prettier and ESLint enforce formatting. Arrow function parameters have no parentheses (`error => ...`).
- `tsconfig` turns on `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`. Prefix unused parameters with `_`, and cast route params, e.g. `req.params.id as string`.
- The default page size is set in each service (e.g. questions use 7), not globally.
