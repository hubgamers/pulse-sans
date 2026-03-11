import z from "zod";

export const CreateUserSchema = z.object({
    username: z
        .string()
        .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/, "Seuls les lettres, chiffres et underscores sont autorisés"),
    display_name: z
        .string()
        .min(2, "Le nom d'affichage est trop court")
        .max(50),
    country: z.string().optional(),
    city: z.string().optional(),
    avatar_url: z.string().url("Lien d'avatar invalide").optional().or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;