import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { RoleContext, type Role } from "./RoleContext";

export const RoleProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [role, setRole] = useState<Role>(() => {
        if (user?.role) return user.role as Role;
        return "internal";
    });

    // Sync role when the authenticated user's role changes (adjust state
    // during render rather than in an effect).
    const userRole = user?.role;
    const [prevUserRole, setPrevUserRole] = useState(userRole);
    if (userRole !== prevUserRole) {
        setPrevUserRole(userRole);
        if (userRole) setRole(userRole as Role);
    }

    return (
        <RoleContext.Provider value={{ role, setRole }}>
            {children}
        </RoleContext.Provider>
    );
};
