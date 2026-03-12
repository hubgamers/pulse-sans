import { z } from "zod";
import { Role } from "@prisma/client";

export const UserSchema = z.object({
    username: z.string().min(3, "Le pseudo doit faire au moins 3 caractères").max(20),
    display_name: z.string().min(2, "Le nom d'affichage est requis"),
    country: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    avatar_url: z.string().url().optional().nullable(),
    roles: z.array(z.nativeEnum(Role)).default([Role.USER]),
});