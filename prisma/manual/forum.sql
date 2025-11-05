-- Table ForumUser
CREATE TABLE IF NOT EXISTS "ForumUser" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "anonymousTag" INTEGER UNIQUE NOT NULL,
  "avatarUrl" TEXT,
  CONSTRAINT "ForumUser_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Table Thread
CREATE TABLE IF NOT EXISTS "Thread" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "authorId" INTEGER NOT NULL,
  CONSTRAINT "Thread_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "ForumUser" ("id") ON DELETE CASCADE
);

-- Table Reply
CREATE TABLE IF NOT EXISTS "Reply" (
  "id" SERIAL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "authorId" INTEGER NOT NULL,
  "threadId" INTEGER NOT NULL,
  CONSTRAINT "Reply_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "ForumUser" ("id") ON DELETE CASCADE,
  CONSTRAINT "Reply_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "Thread" ("id") ON DELETE CASCADE
);
