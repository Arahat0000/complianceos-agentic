import { useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./AuthContext";

// Loosely-typed user payload as returned by the API / localStorage.
type RawUser = Partial<AuthUser> & { googleId?: string };

const API_BASE_URL = import.meta.env.VITE_API_URL;
const BACKEND_URL = import.meta.env.VITE_API_URL;

const mapUserInfo = (newUser: RawUser | null | undefined): AuthUser | null => {
    if (!newUser) return null;
    const mappedUser: AuthUser = { ...newUser } as AuthUser;
    const avatarUrl = newUser.avatarUrl || newUser.avatar || newUser.AvatarUrl || newUser.avatar_url || newUser.picture || newUser.photoURL || newUser.photoUrl;

    if (avatarUrl) {
        // If it's a relative path starting with /, prefix with BACKEND_URL
        if (typeof avatarUrl === 'string' && avatarUrl.startsWith("/")) {
            mappedUser.avatar = `${BACKEND_URL}${avatarUrl}`;
        } else {
            mappedUser.avatar = avatarUrl;
        }
    }

    // Pass through flags for password/google status
    mappedUser.hasPassword = newUser.hasPassword === false ? false : true;
    mappedUser.isGoogleUser = newUser.isGoogleUser === true || !!newUser.googleId;

    return mappedUser;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const storedUser = localStorage.getItem("auth_user");
        if (!storedUser) return null;
        try {
            return mapUserInfo(JSON.parse(storedUser));
        } catch {
            return null;
        }
    });
    const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"));
    const [isLoading, setIsLoading] = useState(false);

    const saveAuth = (newToken: string, newUser: RawUser | null) => {
        const mappedUser = mapUserInfo(newUser);
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(mappedUser));
        setToken(newToken);
        setUser(mappedUser);
    };

    const DEMO_PASSWORD = "password123";

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        // These shortcuts must also check the password — matching on email
        // alone meant typing "demo@example.com" into the real login
        // form with *any* password logged you straight in, bypassing
        // validation entirely. The demo card itself is unaffected since it
        // always sends the correct DEMO_PASSWORD.
        if (email === "demo@example.com" && password === DEMO_PASSWORD) {
            const mockUser: AuthUser = {
                id: "dummy-admin-id",
                email: email,
                name: "Sarah Jenkins",
                role: "internal",
                avatar: "https://api.dicebear.com/10.x/adventurer/svg?seed=dsy8zrwd"
            };
            saveAuth("dummy-admin-token-12345", mockUser);
            setIsLoading(false);
            return { success: true, user: mockUser };
        }
        if (email === "vendor@complianceos.ai" && password === DEMO_PASSWORD) {
            const mockUser: AuthUser = {
                id: "dummy-vendor-id",
                email: "vendor@complianceos.ai",
                name: "Acme Corp (Vendor Partner)",
                role: "vendor",
                avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Acme"
            };
            saveAuth("dummy-vendor-token-12345", mockUser);
            setIsLoading(false);
            return { success: true, user: mockUser };
        }

        try {
            const resp = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await resp.json();

            if (resp.ok) {
                const loggedInUser = { ...data.user, role: "internal" };
                saveAuth(data.token, loggedInUser);
                return { success: true, user: loggedInUser };
            } else {
                if (data.requiresOtp) {
                    return { success: false, requiresOtp: true };
                }
                return { success: false, error: data.error || "Login failed" };
            }
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await resp.json();

            if (resp.ok) {
                if (data.requiresOtp) {
                    return { success: true, requiresOtp: true };
                }
                const loggedInUser = { ...data.user, role: "internal" };
                saveAuth(data.token, loggedInUser);
                return { success: true, user: loggedInUser };
            } else {
                return { success: false, error: data.error || "Registration failed" };
            }
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const verifyOtp = async (email: string, otp: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });

            const data = await resp.json();

            if (resp.ok) {
                const loggedInUser = { ...data.user, role: "internal" };
                saveAuth(data.token, loggedInUser);
                return { success: true, user: loggedInUser };
            } else {
                return { success: false, error: data.error || "OTP verification failed" };
            }
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const resendOtp = async (email: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await resp.json();
            return resp.ok ? { success: true } : { success: false, error: data.error };
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const forgotPassword = async (email: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await resp.json();
            return resp.ok ? { success: true } : { success: false, error: data.error };
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const resetPassword = async (email: string, otp: string, newPassword: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            const data = await resp.json();
            return resp.ok ? { success: true } : { success: false, error: data.error };
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = async (code: string) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });

            const data = await resp.json();

            if (resp.ok) {
                const loggedInUser = { ...data.user, role: "internal" };
                saveAuth(data.token, loggedInUser);
                return { success: true, user: loggedInUser };
            } else {
                return { success: false, error: data.error || "Google login failed" };
            }
        } catch {
            return { success: false, error: "Network error" };
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUser = async () => {
        if (!token) return;
        if (token.startsWith("dummy-")) return;
        try {
            const resp = await fetch(`${API_BASE_URL}/users/me`, {
                headers: { "Authorization": `Bearer ${token}` },
            });
            const data = await resp.json();
            // GET /users/me returns the user row directly (not wrapped in
            // `{ user }`) and includes the caller's org Membership role
            // (ADMIN/EDITOR/VIEWER) — that's a different concept from
            // AuthUser.role ("internal" | "vendor", which drives the
            // internal-workspace-vs-vendor-portal UI switch), so it's
            // deliberately discarded here rather than passed through.
            if (resp.ok && data?.id) {
                saveAuth(token, { ...data, role: "internal" });
            }
        } catch (err) {
            console.error("Failed to refresh user:", err);
        }
    };

    const updateProfile = async (updateData: { name?: string; avatarUrl?: string }) => {
        if (token?.startsWith("dummy-")) {
            if (user) {
                const updatedUser = { ...user, ...updateData };
                saveAuth(token, updatedUser);
            }
            return { success: true };
        }
        try {
            const resp = await fetch(`${API_BASE_URL}/users/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(updateData),
            });
            const data = await resp.json();
            if (resp.ok) {
                await refreshUser();
                return { success: true };
            }
            return { success: false, error: data.error || "Update failed" };
        } catch {
            return { success: false, error: "Network error" };
        }
    };

    const changePassword = async (currentPassword: string, newPassword: string) => {
        if (token?.startsWith("dummy-")) {
            return { success: true };
        }
        try {
            const resp = await fetch(`${API_BASE_URL}/users/me/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            // 204 No Content on success — resp.json() would throw on an
            // empty body, so only parse it when there's actually a body
            // (the 401 "incorrect password" error case).
            if (resp.ok) {
                return { success: true };
            }
            const data = await resp.json().catch(() => ({}));
            return { success: false, error: data.error || "Password change failed" };
        } catch {
            return { success: false, error: "Network error" };
        }
    };

    const uploadAvatar = async (file: File) => {
        if (token?.startsWith("dummy-")) {
            const avatarUrl = URL.createObjectURL(file);
            if (user) {
                const updatedUser = { ...user, avatar: avatarUrl };
                saveAuth(token, updatedUser);
            }
            return { success: true, avatarUrl };
        }
        try {
            const formData = new FormData();
            formData.append("avatar", file);

            const resp = await fetch(`${API_BASE_URL}/users/avatar`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await resp.json();
            if (resp.ok) {
                await refreshUser();
                return { success: true, avatarUrl: data.avatarUrl };
            }
            return { success: false, error: data.error || "Upload failed" };
        } catch {
            return { success: false, error: "Network error" };
        }
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
    };

    const isAuthenticated = !!token && !!user;
    const isDemo = !!token && token.startsWith("dummy-");

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated,
                isLoading,
                isDemo,
                login,
                register,
                verifyOtp,
                resendOtp,
                forgotPassword,
                resetPassword,
                googleLogin,
                updateProfile,
                changePassword,
                uploadAvatar,
                refreshUser,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
