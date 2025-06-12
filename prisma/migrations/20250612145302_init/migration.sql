/*
  Warnings:

  - You are about to alter the column `availableDate` on the `Profile` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "software" TEXT NOT NULL,
    "whitePaperPath" TEXT NOT NULL,
    "whitePaperUrl" TEXT NOT NULL,
    "domainId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("createdAt", "description", "domainId", "id", "software", "title", "updatedAt", "userId", "whitePaperPath", "whitePaperUrl") SELECT "createdAt", "description", "domainId", "id", "software", "title", "updatedAt", "userId", "whitePaperPath", "whitePaperUrl" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE TABLE "new_CustomerReference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mark" INTEGER NOT NULL,
    "commentary" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CustomerReference" ("commentary", "createdAt", "email", "id", "mark", "name", "phone", "updatedAt", "userId") SELECT "commentary", "createdAt", "email", "id", "mark", "name", "phone", "updatedAt", "userId" FROM "CustomerReference";
DROP TABLE "CustomerReference";
ALTER TABLE "new_CustomerReference" RENAME TO "CustomerReference";
CREATE TABLE "new_Diploma" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "skills" JSONB NOT NULL,
    "languages" JSONB NOT NULL,
    "userId" INTEGER NOT NULL,
    "domainId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diploma_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Diploma_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Diploma" ("createdAt", "domainId", "id", "languages", "skills", "title", "type", "updatedAt", "userId") SELECT "createdAt", "domainId", "id", "languages", "skills", "title", "type", "updatedAt", "userId" FROM "Diploma";
DROP TABLE "Diploma";
ALTER TABLE "new_Diploma" RENAME TO "Diploma";
CREATE TABLE "new_Experience" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "client" TEXT,
    "domains" TEXT,
    "skills" JSONB NOT NULL,
    "languages" JSONB NOT NULL,
    "realTitle" TEXT,
    "realDescription" TEXT,
    "realFilePath" TEXT,
    "userId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Experience" ("client", "createdAt", "description", "domains", "id", "languages", "realDescription", "realFilePath", "realTitle", "skills", "title", "updatedAt", "userId") SELECT "client", "createdAt", "description", "domains", "id", "languages", "realDescription", "realFilePath", "realTitle", "skills", "title", "updatedAt", "userId" FROM "Experience";
DROP TABLE "Experience";
ALTER TABLE "new_Experience" RENAME TO "Experience";
CREATE TABLE "new_Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "threadId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "content", "createdAt", "id", "threadId", "updatedAt") SELECT "authorId", "content", "createdAt", "id", "threadId", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE TABLE "new_Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstname" TEXT DEFAULT '',
    "lastname" TEXT DEFAULT '',
    "phone" TEXT DEFAULT '',
    "bio" TEXT DEFAULT '',
    "languages" JSONB DEFAULT [],
    "siret" TEXT DEFAULT '',
    "registrationNumber" TEXT DEFAULT '',
    "smallDayRate" INTEGER DEFAULT 0,
    "mediumDayRate" INTEGER DEFAULT 0,
    "highDayRate" INTEGER DEFAULT 0,
    "isEmployed" BOOLEAN DEFAULT false,
    "availableDate" DATETIME,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("availableDate", "bio", "firstname", "highDayRate", "id", "isEmployed", "languages", "lastname", "mediumDayRate", "phone", "registrationNumber", "siret", "smallDayRate", "userId") SELECT "availableDate", "bio", "firstname", "highDayRate", "id", "isEmployed", "languages", "lastname", "mediumDayRate", "phone", "registrationNumber", "siret", "smallDayRate", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE TABLE "new_Thread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Thread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Thread" ("authorId", "createdAt", "id", "subject", "updatedAt") SELECT "authorId", "createdAt", "id", "subject", "updatedAt" FROM "Thread";
DROP TABLE "Thread";
ALTER TABLE "new_Thread" RENAME TO "Thread";
CREATE TABLE "new_Training" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skills" JSONB NOT NULL,
    "userId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Training_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Training" ("createdAt", "description", "id", "skills", "title", "updatedAt", "userId") SELECT "createdAt", "description", "id", "skills", "title", "updatedAt", "userId" FROM "Training";
DROP TABLE "Training";
ALTER TABLE "new_Training" RENAME TO "Training";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isAdmin", "password", "updatedAt", "username") SELECT "createdAt", "email", "id", "isAdmin", "password", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
