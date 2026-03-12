import { z } from "zod";

export const PlayerSchema = z.object({
    nickname: z.string().min(2),
    role: z.string().optional().nullable(),
    number: z.number().int().optional().nullable(),
    teamId: z.string().uuid(),
    userId: z.string().cuid().optional().nullable(),
    isActive: z.boolean().default(true),
});