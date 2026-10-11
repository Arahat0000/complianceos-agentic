import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import StacksIcon from "@/components/stack_icon";
import { AuthShowcasePanel } from "@/components/auth-showcase-panel";
import { LoginForm } from "@/components/login-form";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";

interface DemoCardProps {
  title: string;
  email: string;
  roleDescription: string;
  icon: React.ReactNode;
  accentClass: string;
  glowClass: string;
  onClick: () => void;
  disabled: boolean;
}

function DemoCard({ title, email, roleDescription, icon, accentClass, glowClass, onClick, disabled }: DemoCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`flex flex-col items-start text-left w-full p-4 rounded-xl border border-border/60 bg-card/45 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer ${glowClass} disabled:opacity-50 disabled:pointer-events-none group`}
    >
      <div className="flex items-center gap-3 w-full mb-2">
        <div className={`p-2 rounded-lg bg-muted/80 border border-border/50 group-hover:scale-110 transition-transform duration-300 ${accentClass}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground leading-none">{title}</h3>
          <span className="text-[10px] text-muted-foreground font-mono">{email}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {roleDescription}
      </p>
    </motion.button>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const { login, verifyOtp, isAuthenticated, googleLogin } = useAuth();
  const { setRole } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleLogin = async (eEmail: string, password: string) => {
    setIsLoading(true);
    setLoginError(null);
    setEmail(eEmail);

    try {
      const result = await login(eEmail, password);
      if (result.success) {
        const userRole = result.user?.role || "internal";
        setRole(userRole);
        navigate(from, { replace: true });
      } else if (result.requiresOtp) {
        setOtpSent(true);
      } else {
        setLoginError(result.error || "Invalid credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    const result = await verifyOtp(email, otp);

    if (result.success) {
      const userRole = result.user?.role || "internal";
      setRole(userRole);
      navigate(from, { replace: true });
    } else {
      setLoginError(result.error || "Verification failed");
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async (token: string) => {
    setIsLoading(true);
    setLoginError(null);
    const result = await googleLogin(token); // auth-code flow
    if (result.success) {
      const userRole = result.user?.role || "internal";
      setRole(userRole);
      navigate(from, { replace: true });
    } else {
      setLoginError(result.error || "Google login failed");
    }
    setIsLoading(false);
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a
            href="/"
            className="flex items-center gap-1 font-medium text-foreground"
          >
            <div className="flex size-6 shrink-0 items-center justify-center">
              <StacksIcon size={24} color="text-primary" />
            </div>
            ComplianceOS
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {!otpSent ? (
              <div className="flex flex-col gap-6">
                <LoginForm
                  onSubmit={handleLogin}
                  onGoogleLogin={handleGoogleLogin}
                  isLoading={isLoading}
                  error={loginError}
                />

                <div className="flex flex-col gap-4">
                  <div className="relative flex items-center justify-center mb-4">
                    <hr className="w-full border-border/40" />
                    <span className="absolute bg-background px-2 text-xs text-muted-foreground">
                      Quick Demo on
                    </span>
                  </div>

                  <DemoCard
                    title="Compliance Officer"
                    email="demo@example.com"
                    roleDescription="Full access to internal workspace, compliance gaps, audit logs & settings."
                    accentClass="text-emerald-500 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30"
                    glowClass="hover:border-emerald-500/30 hover:shadow-emerald-500/5 hover:bg-emerald-500/[0.01]"
                    icon={<ShieldCheck className="size-4 text-muted-foreground group-hover:text-foreground" />}
                    onClick={() => handleLogin("demo@example.com", "password123")}
                    disabled={isLoading}
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
                <FieldGroup>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold text-foreground">Verify Login</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                      Your email is not verified. Enter the code sent to {email}
                    </p>
                  </div>
                  {loginError && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive font-medium">
                      {loginError}
                    </div>
                  )}
                  <Field>
                    <FieldLabel htmlFor="otp">OTP Code</FieldLabel>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                      disabled={isLoading}
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setOtpSent(false)}
                    disabled={isLoading}
                  >
                    Back to login
                  </Button>
                </FieldGroup>
              </form>
            )}
          </div>
        </div>
        <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
      <div className="relative hidden lg:block">
        <AuthShowcasePanel />
      </div>
    </div>
  );
}
