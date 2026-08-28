-- Ajout du champ email dans la table Profile
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
