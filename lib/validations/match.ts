import { z } from "zod";
import { MatchStatus } from "@prisma/client";

export const MatchSchema = z.object({
    status: z.nativeEnum(MatchStatus).default(MatchStatus.SCHEDULED),
    phaseId: z.string().uuid(),
    pitchId: z.string().uuid(),
    homeTeamId: z.string().uuid().optional().nullable(),
    awayTeamId: z.string().uuid().optional().nullable(),
    scheduledAt: z.coerce.date().optional().nullable(),
});