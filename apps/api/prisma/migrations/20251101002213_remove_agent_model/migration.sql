/*
  Warnings:

  - You are about to drop the column `agentId` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the `Agent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `personaId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Agent" DROP CONSTRAINT "Agent_personaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Conversation" DROP CONSTRAINT "Conversation_agentId_fkey";

-- DropIndex
DROP INDEX "public"."Conversation_agentId_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "agentId",
ADD COLUMN     "personaId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Agent";

-- CreateIndex
CREATE INDEX "Conversation_personaId_idx" ON "Conversation"("personaId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
