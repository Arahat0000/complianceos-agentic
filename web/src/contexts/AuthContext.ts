import { createContext, useContext } from "react";

type UserRole = "internal" | "vendor";

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar?: string;
    avatarUrl?: string;
    AvatarUrl?: string;
    avatar_url?: string;
    picture?: string;
    photoURL?: string;
    photoUrl?: string;
    hasPassword?: boolean;
    isGoogleUser?: boolean;
}

export interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    // True for the "Quick Demo" card and any other dummy-* session. Pages
    // being migrated off hardcoded mock data must keep rendering that mock
    // data when this is true, and only fetch from the real API otherwise —
    // see web/src/lib/demoData.ts for the shared helper.
    isDemo: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; requiresOtp?: boolean; error?: string; user?: AuthUser }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; requiresOtp?: boolean; error?: string; user?: AuthUser }>;
    verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
    resendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
    googleLogin: (code: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
    updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
    uploadAvatar: (file: File) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
