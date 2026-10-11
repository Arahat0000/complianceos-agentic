import { createContext, useContext } from "react";

export type Role = "internal" | "vendor";

export interface RoleContextType {
    role: Role;
    setRole: (role: Role) => void;
}

export const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
    const context = useContext(RoleContext);
    if (!context) throw new Error("useRole must be used within RoleProvider");
    return context;
};
