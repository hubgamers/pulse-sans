"use client";
import OrganizationList from "@/components/dashboard/OrganizationList";

export default function Dashboard() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-4xl font-bold text-white">Bienvenue sur votre dashboard !</h1>
      <section>
        <OrganizationList />
      </section>
    </div>
  );
}