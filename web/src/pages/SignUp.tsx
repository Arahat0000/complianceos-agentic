import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StacksIcon from "@/components/stack_icon";
import { AuthShowcasePanel } from "@/components/auth-showcase-panel";
import { SignUpForm } from "@/components/signup-form";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  
  const { register, verifyOtp, resendOtp, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleResendOtp = async () => {
    setIsLoading(true);
    setError(null);
    const result = await resendOtp(email);
    if (result.success) {
      import("sonner").then(({ toast }) => toast.success("A new verification code has been sent."));
    } else {
      setError(result.error || "Failed to resend OTP");
    }
    setIsLoading(false);
  };

  const handleSignUp = async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setEmail(data.email);
    
    const result = await register(data.name, data.email, data.password);
    
    if (result.success) {
      if (result.requiresOtp) {
        setOtpSent(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } else {
      setError(result.error || "Signup failed");
    }
    setIsLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const result = await verifyOtp(email, otp);
    
    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Verification failed");
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async (token: string) => {
    setIsLoading(true);
    setError(null);
    const result = await googleLogin(token); // auth-code flow
    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Google signup failed");
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
              <SignUpForm
                onSubmit={handleSignUp}
                onGoogleLogin={handleGoogleLogin}
                isLoading={isLoading}
                error={error}
              />
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
                <FieldGroup>
                  <div className="flex flex-col items-center gap-1 text-center font-outfit">
                    <h1 className="text-2xl font-bold text-foreground">Verify Email</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                      Enter the 6-digit code sent to {email}
                    </p>
                  </div>
                  {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive font-medium">
                      {error}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => setOtp(value)}
                      disabled={isLoading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length < 6}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                  
                  <div className="flex flex-col gap-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      Didn&apos;t receive the code?{" "}
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        className="text-primary hover:underline font-medium disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    </p>

                    <Button 
                      variant="ghost" 
                      type="button" 
                      onClick={() => setOtpSent(false)}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      Back to signup
                    </Button>
                  </div>
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
