-- Add isGlobal column to Persona table
ALTER TABLE "Persona" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Persona_isGlobal_idx" ON "Persona"("isGlobal");
