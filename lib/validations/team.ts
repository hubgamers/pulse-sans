import { z } from "zod";

export const TeamSchema = z.object({
    name: z.string().min(2, "Nom d'équipe requis"),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    logoUrl: z.string().url().optional().nullable(),
    organizationId: z.string().uuid(),
});