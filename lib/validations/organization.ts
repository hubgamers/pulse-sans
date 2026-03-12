import { z } from "zod";
import { OrgType } from "@prisma/client";

export const OrganizationSchema = z.object({
    name: z.string().min(2, "Nom trop court").max(50),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Format slug invalide"),
    type: z.nativeEnum(OrgType).default(OrgType.MIXED),
    logoUrl: z.string().url().optional().nullable().or(z.literal("")),
    ownerId: z.string().uuid(),
});