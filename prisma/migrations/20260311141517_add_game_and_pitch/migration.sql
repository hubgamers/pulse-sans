/*
  Warnings:

  - You are about to drop the column `game` on the `tournaments` table. All the data in the column will be lost.
  - Added the required column `pitch_id` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `game_id` to the `tournaments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "pitch_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "tournaments" DROP COLUMN "game",
ADD COLUMN     "game_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT;

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "phaseId" TEXT,

    CONSTRAINT "pitches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
