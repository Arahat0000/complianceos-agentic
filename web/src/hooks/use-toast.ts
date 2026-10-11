import * as React from "react";
import { toast as sonnerToast } from "sonner";


// The app renders Sonner's <Toaster /> (see App.tsx) as its only toast
// viewport. This hook keeps the shadcn-style `toast({ title, description,
// variant })` call signature that's already used across ~15 pages, but
// delegates to Sonner underneath — a previous version of this file drove a
// separate Radix toast state machine that nothing ever rendered, so every
// toast() call in the app silently no-op'd.
type ToastProps = { variant?: "default" | "destructive" };
type ToastActionElement = React.ReactElement;

type Toast = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastProps["variant"];
  action?: ToastActionElement;
};

function toast({ title, description, variant }: Toast) {
  const id =
    variant === "destructive"
      ? sonnerToast.error(title, { description })
      : sonnerToast(title, { description });

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, };
