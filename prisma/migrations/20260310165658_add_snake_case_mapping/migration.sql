/*
  Warnings:

  - You are about to drop the column `awayScore` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `homeScore` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `matchId` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `recordedAt` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `recordedById` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `winnerId` on the `match_results` table. All the data in the column will be lost.
  - You are about to drop the column `awayTeamId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `bracketPos` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `homeTeamId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `phaseId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `playedAt` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `roundNumber` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `joinedAt` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `organization_members` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `phases` table. All the data in the column will be lost.
  - You are about to drop the column `isCompleted` on the `phases` table. All the data in the column will be lost.
  - You are about to drop the column `tournamentId` on the `phases` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `teamId` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `isConfirmed` on the `tournament_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `registeredAt` on the `tournament_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `teamId` on the `tournament_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `tournamentId` on the `tournament_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `bannerUrl` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `maxTeams` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[match_id]` on the table `match_results` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,user_id]` on the table `organization_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,slug]` on the table `teams` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tournament_id,team_id]` on the table `tournament_registrations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,slug]` on the table `tournaments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `away_score` to the `match_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `home_score` to the `match_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `match_id` to the `match_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phase_id` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `organization_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `organization_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tournament_id` to the `phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team_id` to the `players` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `teams` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `teams` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team_id` to the `tournament_registrations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tournament_id` to the `tournament_registrations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `tournaments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `tournaments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `display_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "match_results" DROP CONSTRAINT "match_results_matchId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_awayTeamId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_homeTeamId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "phases" DROP CONSTRAINT "phases_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_teamId_fkey";

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_userId_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tournament_registrations" DROP CONSTRAINT "tournament_registrations_teamId_fkey";

-- DropForeignKey
ALTER TABLE "tournament_registrations" DROP CONSTRAINT "tournament_registrations_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_organizationId_fkey";

-- DropIndex
DROP INDEX "match_results_matchId_key";

-- DropIndex
DROP INDEX "organization_members_organizationId_userId_key";

-- DropIndex
DROP INDEX "teams_organizationId_slug_key";

-- DropIndex
DROP INDEX "tournament_registrations_tournamentId_teamId_key";

-- DropIndex
DROP INDEX "tournaments_organizationId_slug_key";

-- AlterTable
ALTER TABLE "match_results" DROP COLUMN "awayScore",
DROP COLUMN "homeScore",
DROP COLUMN "matchId",
DROP COLUMN "recordedAt",
DROP COLUMN "recordedById",
DROP COLUMN "winnerId",
ADD COLUMN     "away_score" INTEGER NOT NULL,
ADD COLUMN     "home_score" INTEGER NOT NULL,
ADD COLUMN     "match_id" TEXT NOT NULL,
ADD COLUMN     "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "recorded_by_id" TEXT,
ADD COLUMN     "winner_id" TEXT;

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "awayTeamId",
DROP COLUMN "bracketPos",
DROP COLUMN "createdAt",
DROP COLUMN "homeTeamId",
DROP COLUMN "phaseId",
DROP COLUMN "playedAt",
DROP COLUMN "roundNumber",
DROP COLUMN "scheduledAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "away_team_id" TEXT,
ADD COLUMN     "bracket_pos" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "home_team_id" TEXT,
ADD COLUMN     "phase_id" TEXT NOT NULL,
ADD COLUMN     "played_at" TIMESTAMP(3),
ADD COLUMN     "round_number" INTEGER,
ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "organization_members" DROP COLUMN "joinedAt",
DROP COLUMN "organizationId",
DROP COLUMN "userId",
ADD COLUMN     "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "createdAt",
DROP COLUMN "logoUrl",
DROP COLUMN "ownerId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "phases" DROP COLUMN "createdAt",
DROP COLUMN "isCompleted",
DROP COLUMN "tournamentId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tournament_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "players" DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "teamId",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "team_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "createdAt",
DROP COLUMN "logoUrl",
DROP COLUMN "organizationId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tournament_registrations" DROP COLUMN "isConfirmed",
DROP COLUMN "registeredAt",
DROP COLUMN "teamId",
DROP COLUMN "tournamentId",
ADD COLUMN     "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "team_id" TEXT NOT NULL,
ADD COLUMN     "tournament_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "tournaments" DROP COLUMN "bannerUrl",
DROP COLUMN "createdAt",
DROP COLUMN "endDate",
DROP COLUMN "isPublic",
DROP COLUMN "maxTeams",
DROP COLUMN "organizationId",
DROP COLUMN "startDate",
DROP COLUMN "updatedAt",
ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_teams" INTEGER,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatarUrl",
DROP COLUMN "createdAt",
DROP COLUMN "displayName",
DROP COLUMN "updatedAt",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "display_name" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_id_key" ON "match_results"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_team_id_key" ON "tournament_registrations"("tournament_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_organization_id_slug_key" ON "tournaments"("organization_id", "slug");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
