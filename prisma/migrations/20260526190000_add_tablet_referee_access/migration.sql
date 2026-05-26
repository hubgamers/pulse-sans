ALTER TYPE "public"."OrgRole" ADD VALUE IF NOT EXISTS 'REFEREE';

ALTER TABLE "public"."tournaments"
ADD COLUMN "tablet_requires_referee" BOOLEAN NOT NULL DEFAULT false;
