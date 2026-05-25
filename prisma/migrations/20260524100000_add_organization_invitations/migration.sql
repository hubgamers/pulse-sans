CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "public"."organization_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."OrgRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "organization_id" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "invited_by_name" TEXT,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invitations_token_key" ON "public"."organization_invitations"("token");
CREATE INDEX "organization_invitations_email_status_idx" ON "public"."organization_invitations"("email", "status");
CREATE INDEX "organization_invitations_organization_id_status_idx" ON "public"."organization_invitations"("organization_id", "status");

ALTER TABLE "public"."organization_invitations"
ADD CONSTRAINT "organization_invitations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
