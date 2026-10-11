import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface ForgotPasswordFormProps extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  onSubmit?: (email: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function ForgotPasswordForm({
  className,
  onSubmit,
  isLoading = false,
  error,
  success,
  ...props
}: ForgotPasswordFormProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value ?? "";
    await onSubmit?.(email);
  };

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
            <p className="text-muted-foreground text-sm text-balance">
              If an account exists for that email, we&apos;ve sent a password reset link.
            </p>
          </div>
          <Field>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to login</Link>
            </Button>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive font-medium">
            {error}
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            disabled={isLoading}
          />
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
          <FieldDescription className="text-center">
            <Link to="/login" className="underline underline-offset-4 hover:text-foreground">
              Back to login
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
