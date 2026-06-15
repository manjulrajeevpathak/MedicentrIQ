"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { submitStaffAction, type StaffActionRequest } from "@/lib/core-api";
import { cn } from "@/lib/utils";

export function ActionButton({
  action,
  userId,
  children,
  permitted = true,
  restrictedReason,
  onSuccess,
  confirm,
  variant = "outline",
  size = "sm",
  icon,
  className
}: {
  action: StaffActionRequest;
  userId: string;
  children: ReactNode;
  permitted?: boolean;
  restrictedReason?: string;
  /** Applies the optimistic local mutation after the action succeeds. */
  onSuccess?: () => void;
  /** When set, a confirmation dialog gates the action. */
  confirm?: { title: string; body: string; confirmLabel?: string; danger?: boolean };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: ReactNode;
  className?: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const execute = () => {
    startTransition(async () => {
      const result = await submitStaffAction({ id: userId }, action);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onSuccess?.();
    });
  };

  const run = () => {
    if (!permitted) {
      toast(restrictedReason ?? "You do not have permission for this action.", "error");
      return;
    }
    if (confirm) {
      setConfirmOpen(true);
      return;
    }
    execute();
  };

  return (
    <>
      <Button
        variant={permitted ? variant : "ghost"}
        size={size}
        onClick={run}
        disabled={pending}
        title={!permitted ? restrictedReason : undefined}
        className={cn(!permitted && "cursor-not-allowed text-ink-faint", className)}
      >
        {!permitted ? <Lock className="size-3.5" /> : icon}
        {pending ? "Working…" : children}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={execute}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
        />
      ) : null}
    </>
  );
}
