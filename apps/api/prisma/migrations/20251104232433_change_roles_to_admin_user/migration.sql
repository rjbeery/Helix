-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';

-- Data migration: Update existing roles
-- Set rjbeery@gmail.com as admin
UPDATE "User" SET "role" = 'admin' WHERE "email" = 'rjbeery@gmail.com';

-- Set all master roles to admin (in case there are others)
UPDATE "User" SET "role" = 'admin' WHERE "role" = 'master';

-- Set all guest roles to user
UPDATE "User" SET "role" = 'user' WHERE "role" = 'guest';
