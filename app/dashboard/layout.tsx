import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClientShell from "./DashboardClientShell";
import { findNavigationItems } from "@/lib/actions/admin/navitem.actions";
import { NavigationContext } from "@prisma/client";
import { prisma } from "@/lib/prisma"; // Assure-toi d'importer ton instance prisma

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();

  if (error || !authUser) {
    redirect("/login");
  }

  // 1. Récupérer l'utilisateur complet depuis ta table Prisma (schéma public)
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      display_name: true,
      avatar_url: true,
      roles: true, // C'est ici que tu récupères tes fameux rôles !
    }
  });

  // 2. Récupère les éléments de navigation (tu peux aussi passer le contexte ADMIN si dbUser est admin)
  // layout.tsx

  // 1. On détermine si l'utilisateur est admin
  const isAdmin = dbUser?.roles?.includes("ADMIN");

  // 2. On récupère les items selon les droits
  let navItems;
  if (isAdmin) {
    // L'admin a besoin de TOUT pour que le filtre client puisse les afficher
    navItems = await prisma.navigationItem.findMany({
      where: { isActive: true }, // On ne filtre pas par contexte ici
      include: { children: true },
      orderBy: { order: 'asc' }
    });
  } else {
    // L'utilisateur normal ne reçoit QUE le dashboard user (Sécurité SQL)
    navItems = await findNavigationItems(NavigationContext.USER_DASHBOARD);
  }

  // 3. Fusionner les infos d'auth et les infos de la BDD
  const userData = {
    name: dbUser?.display_name || authUser.user_metadata.full_name || "Utilisateur",
    email: authUser.email,
    avatar: dbUser?.avatar_url || authUser.user_metadata.avatar_url,
    roles: dbUser?.roles || [], // On récupère le tableau d'enums de Prisma
    role: isAdmin ? "ADMIN" as const : "USER" as const,
  };

  return (
    <DashboardClientShell user={userData} navItems={navItems}>
      {children}
    </DashboardClientShell>
  );
}