// src/components/ConfirmButton.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";

export function ConfirmButton({
  title = "Är du säker?",
  description = "",
  confirmText = "Bekräfta",
  cancelText = "Avbryt",
  onConfirm,
  triggerVariant = "destructive",
  triggerSize = "sm",
  children,
  actionVariant = "destructive",
  ...triggerProps
} = {}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} {...triggerProps}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={actionVariant}
              onClick={async () => {
                await onConfirm?.();
              }}
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
