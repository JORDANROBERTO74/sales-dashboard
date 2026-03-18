"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

type PayoutsStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "cancelled" | "rejected";
  isPending: boolean;
  onSubmit: (payload: { status: "cancelled" | "rejected" }) => void;
};

function titleFromStatus(status: "cancelled" | "rejected"): string {
  return status === "cancelled" ? "Cancelar payout" : "Rechazar payout";
}

function descriptionFromStatus(status: "cancelled" | "rejected"): string {
  return status === "cancelled"
    ? "Esta acción marcará el payout como cancelado."
    : "Esta acción marcará el payout como rechazado.";
}

function actionLabelFromStatus(status: "cancelled" | "rejected"): string {
  return status === "cancelled" ? "Confirmar cancelación" : "Confirmar rechazo";
}

export function PayoutsStatusDialog({
  open,
  onOpenChange,
  status,
  isPending,
  onSubmit,
}: PayoutsStatusDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titleFromStatus(status)}</AlertDialogTitle>
          <AlertDialogDescription>{descriptionFromStatus(status)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() =>
              onSubmit({
                status,
              })
            }
          >
            {isPending ? <Spinner /> : null}
            {actionLabelFromStatus(status)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
