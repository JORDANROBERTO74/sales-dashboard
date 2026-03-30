"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { SellerOption, StripeTransactionRow } from "@/types/transactions";
import type { AssignTransactionPayload } from "@/hooks/transactions/use-transactions";

type AssignTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: StripeTransactionRow | null;
  sellers: SellerOption[];
  isSubmitting: boolean;
  isAssignmentFrozen?: boolean;
  onSubmit: (payload: AssignTransactionPayload) => void;
};

function getRoleLabel(roleName: SellerOption["role_name"]): string {
  if (!roleName) return "Sin rol";
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

export function AssignTransactionDialog({
  open,
  onOpenChange,
  transaction,
  sellers,
  isSubmitting,
  isAssignmentFrozen = false,
  onSubmit,
}: AssignTransactionDialogProps) {
  const [sellerUserId, setSellerUserId] = useState("");
  const [notes, setNotes] = useState("");

  const sellerLabel = useMemo(() => {
    const seller = sellers.find((item) => item.id === sellerUserId);
    if (!seller) return "";
    const identity = seller.full_name ? `${seller.full_name} (${seller.email})` : seller.email;
    return `${identity} - ${getRoleLabel(seller.role_name)}`;
  }, [sellerUserId, sellers]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSellerUserId("");
      setNotes("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = () => {
    if (!transaction || !sellerUserId) return;
    onSubmit({
      transactionId: transaction.id,
      sellerUserId,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-stop-card-nav="true">
        <DialogHeader>
          <DialogTitle>Asignar transacción</DialogTitle>
          <DialogDescription>
            Selecciona el responsable para asociar la transacción
            {transaction ? ` ${transaction.stripe_id}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-seller">Responsable</Label>
            <Select value={sellerUserId} onValueChange={setSellerUserId}>
              <SelectTrigger className="w-full" id="assignment-seller" aria-label="Seleccionar responsable">
                <SelectValue placeholder="Selecciona un responsable" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {(seller.full_name ? `${seller.full_name} (${seller.email})` : seller.email)
                      + ` - ${getRoleLabel(seller.role_name)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sellerLabel ? (
              <p className="text-xs text-muted-foreground">Seleccionado: {sellerLabel}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignment-notes">Notas (opcional)</Label>
            <Textarea
              id="assignment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Agrega contexto para auditoría interna..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleSubmit}
            disabled={!sellerUserId || isSubmitting || isAssignmentFrozen}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Asignando...
              </span>
            ) : isAssignmentFrozen ? (
              "Asignación cerrada"
            ) : (
              "Confirmar asignación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
