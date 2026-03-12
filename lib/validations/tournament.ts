import { z } from "zod";
import { TournamentStatus } from "@prisma/client";

export const TournamentSchema = z.object({
    name: z.string().min(3),
    slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
    description: z.string().optional().nullable(),
    status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
    gameId: z.string().uuid(),
    organizationId: z.string().uuid(),
    maxTeams: z.number().int().positive().optional().nullable(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
}).refine(data => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "La date de fin doit être après le début",
    path: ["endDate"]
});