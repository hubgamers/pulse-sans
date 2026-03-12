// prisma/seed.ts
import { PrismaClient, NavigationContext } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Début du nettoyage...')
    // On vide la table pour repartir sur une base saine
    await prisma.navigationItem.deleteMany({})

    console.log('🚀 Début du seed des menus (Version Simplifiée)...')

    const menuItems = [
        // --- CATEGORIE ADMIN (ADMIN_SaaS) ---
        { name: 'adm_dash', label: 'Tableau de bord', href: '/admin', icon: 'LayoutDashboard', order: 1, context: NavigationContext.ADMIN_SaaS },
        { name: 'adm_users', label: 'Users', href: '/admin/users', icon: 'Users', order: 2, context: NavigationContext.ADMIN_SaaS },
        { name: 'adm_orgs', label: 'Organizations', href: '/admin/organizations', icon: 'Building', order: 3, context: NavigationContext.ADMIN_SaaS },
        { name: 'adm_tournaments', label: 'Tournaments', href: '/admin/tournaments', icon: 'Trophy', order: 4, context: NavigationContext.ADMIN_SaaS },
        { name: 'adm_teams', label: 'Teams', href: '/admin/teams', icon: 'Users2', order: 5, context: NavigationContext.ADMIN_SaaS },
        { name: 'adm_settings', label: 'Settings', href: '/admin/settings', icon: 'Settings', order: 6, context: NavigationContext.ADMIN_SaaS },

        // --- CATEGORIE USER (USER_DASHBOARD) ---
        { name: 'usr_dash', label: 'Tableau de bord', href: '/dashboard', icon: 'LayoutDashboard', order: 1, context: NavigationContext.USER_DASHBOARD },
        { name: 'org_tournaments', label: 'Mes tournois', href: '/dashboard/org/[slug]/tournaments', icon: 'Trophy', order: 2, context: NavigationContext.ORGANIZATION },
        { name: 'org_teams', label: 'Mes équipes', href: '/dashboard/org/[slug]/teams', icon: 'Users2', order: 3, context: NavigationContext.ORGANIZATION },
        { name: 'org_matches', label: 'Mes matchs', href: '/dashboard/org[slug]/matches', icon: 'Play', order: 4, context: NavigationContext.ORGANIZATION },
        { name: 'usr_subs', label: 'Abonnements', href: '/dashboard/billing', icon: 'CreditCard', order: 5, context: NavigationContext.USER_DASHBOARD },
        { name: 'usr_settings', label: 'Paramètres', href: '/dashboard/settings', icon: 'Settings2', order: 6, context: NavigationContext.USER_DASHBOARD },
    ]

    // Utilisation d'une boucle simple pour garantir l'ordre et l'exécution
    for (const item of menuItems) {
        const created = await prisma.navigationItem.create({
            data: item
        })
        console.log(`  ✅ Créé : ${created.name} (${created.context})`)
    }

    console.log('✨ Seed terminé avec succès !')
}

main()
    .catch((e) => {
        console.error('❌ Erreur lors du seed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })