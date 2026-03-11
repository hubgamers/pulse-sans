// prisma/seed.ts
import { PrismaClient, NavigationContext } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // 1. Navigation pour l'Admin du SaaS
    const adminItems = [
        { name: 'overview', label: 'Vue d\'ensemble', href: '/admin', icon: 'LayoutDashboard', order: 1, context: NavigationContext.ADMIN_SaaS },
        { name: 'orgs', label: 'Organisations', href: '/admin/organizations', icon: 'Building2', order: 2, context: NavigationContext.ADMIN_SaaS },
        { name: 'users', label: 'Utilisateurs', href: '/admin/users', icon: 'Users', order: 3, context: NavigationContext.ADMIN_SaaS },
        { name: 'billing', label: 'Abonnements', href: '/admin/billing', icon: 'CreditCard', order: 4, context: NavigationContext.ADMIN_SaaS },
        { name: 'settings', label: 'Configuration', href: '/admin/settings', icon: 'Settings', order: 5, context: NavigationContext.ADMIN_SaaS },
    ]

    // 2. Navigation pour le Dashboard Utilisateur
    const userItems = [
        { name: 'dashboard', label: 'Tableau de bord', href: '/dashboard', icon: 'Home', order: 1, context: NavigationContext.USER_DASHBOARD },
        { name: 'tournaments', label: 'Mes Tournois', href: '/dashboard/tournaments', icon: 'Trophy', order: 2, context: NavigationContext.USER_DASHBOARD },
        { name: 'team', label: 'Équipe & Membres', href: '/dashboard/team', icon: 'UserGroup', order: 3, context: NavigationContext.USER_DASHBOARD },
        { name: 'settings', label: 'Paramètres Org', href: '/dashboard/settings', icon: 'Settings', order: 4, context: NavigationContext.USER_DASHBOARD },
    ]

    console.log('Seed des menus en cours...')

    for (const item of [...adminItems, ...userItems]) {
        await prisma.navigationItem.upsert({
            where: { id: item.name + '_' + item.context }, // Utilisation d'un ID stable si possible ou name
            update: {},
            create: item,
        })
    }

    console.log('Menus créés avec succès !')
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
