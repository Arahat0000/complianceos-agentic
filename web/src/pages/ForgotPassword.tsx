import { useState } from "react";
import StacksIcon from "@/components/stack_icon";
import { AuthShowcasePanel } from "@/components/auth-showcase-panel";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleForgotSubmit = async (eEmail: string) => {
    setIsLoading(true);
    setError(null);
    setEmail(eEmail);
    
    const result = await forgotPassword(eEmail);
    if (result.success) {
      setOtpSent(true);
      toast.success("OTP sent to your email");
    } else {
      setError(result.error || "Failed to send reset code.");
    }
    setIsLoading(false);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await resetPassword(email, otp, newPassword);
    if (result.success) {
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } else {
      setError(result.error || "Failed to reset password.");
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
          <div className="w-full max-w-xs">
            {!otpSent ? (
              <ForgotPasswordForm
                onSubmit={handleForgotSubmit}
                isLoading={isLoading}
                error={error}
                success={success}
              />
            ) : (
              <form onSubmit={handleResetSubmit} className="flex flex-col gap-6">
                 <FieldGroup>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                      Enter the code sent to {email} and your new password.
                    </p>
                  </div>
                  {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive font-medium">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm text-primary font-medium">
                      Password reset successful! Redirecting to login...
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
                      disabled={isLoading || success}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isLoading || success}
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={isLoading || success}>
                    {isLoading ? "Resetting..." : "Update Password"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    type="button" 
                    onClick={() => setOtpSent(false)}
                    disabled={isLoading || success}
                  >
                    Back
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
