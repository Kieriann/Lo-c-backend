CREATE TABLE "Message" (
  id SERIAL PRIMARY KEY,
  "senderId"   INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  content      TEXT NOT NULL,
  "isRead"     BOOLEAN DEFAULT FALSE,
  "createdAt"  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_sender FOREIGN KEY ("senderId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT fk_receiver FOREIGN KEY ("receiverId") REFERENCES "User"(id) ON DELETE CASCADE
);
