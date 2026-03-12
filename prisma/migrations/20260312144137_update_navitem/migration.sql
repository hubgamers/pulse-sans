/*
  Warnings:

  - A unique constraint covering the columns `[name,context]` on the table `admin__navigation_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "admin__navigation_items_name_context_key" ON "admin__navigation_items"("name", "context");
