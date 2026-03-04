-- Make userId nullable for global personas
ALTER TABLE "Persona" ALTER COLUMN "userId" DROP NOT NULL;
