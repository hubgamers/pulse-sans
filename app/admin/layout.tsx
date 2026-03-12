import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findNavigationItems } from "@/lib/actions/admin/navitem.actions";
import { NavigationContext } from "@prisma/client";
import DashboardClientShell from "../dashboard/DashboardClientShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    // Sécurité : Si pas de session, on dégage vers le login
    if (error || !user) {
        redirect("/login");
    }

    // Récupère les éléments de navigation pour le contexte ADMIN
    const navItems = await findNavigationItems(NavigationContext.ADMIN_SaaS);

    // On prépare les données utilisateur pour le client
    const userData = {
        name: user.user_metadata.full_name || "Utilisateur",
        email: user.email,
        avatar: user.user_metadata.avatar_url,
        roles: user.user_metadata.roles,
        role: "ADMIN" as const,
    };

    return (
        <DashboardClientShell user={userData} navItems={navItems}>
            {children}
        </DashboardClientShell>
    );
}