-- CreateEnum
CREATE TYPE "NavigationContext" AS ENUM ('ADMIN_SaaS', 'USER_DASHBOARD');

-- CreateTable
CREATE TABLE "admin__navigation_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "context" "NavigationContext" NOT NULL DEFAULT 'USER_DASHBOARD',
    "parentId" TEXT,
    "requiredRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin__navigation_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "admin__navigation_items" ADD CONSTRAINT "admin__navigation_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "admin__navigation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
