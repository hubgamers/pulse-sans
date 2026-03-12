"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { NavigationItem, Organization } from "@prisma/client";

type UserRole = "ADMIN" | "USER";

type UserData = {
    name: string;
    email?: string;
    avatar?: string | null;
    roles?: string[];
    role: UserRole;
};

type NavigationTreeItem = NavigationItem & {
    children: NavigationItem[];
};

interface UserContextType {
    user: UserData;
    navItems: NavigationTreeItem[];
    organizations: Organization[];
    activeOrg: Organization | null;
    setActiveOrg: (org: Organization | null) => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({
    children,
    initialData,
}: {
    children: ReactNode;
    initialData: { user: UserData; navItems: NavigationTreeItem[]; organizations: Organization[] };
}) {
    const [activeOrg, setActiveOrg] = useState<Organization | null>(initialData.organizations[0] || null);

    return (
        <UserContext.Provider
            value={{
                ...initialData,
                activeOrg,
                setActiveOrg,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser doit être utilisé dans un UserProvider");
    return context;
};