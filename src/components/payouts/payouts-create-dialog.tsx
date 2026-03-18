"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CreatePayoutPayload } from "@/hooks/payouts/use-payouts";
import { formatUsdFromCents } from "@/lib/transactions/formatters";
import type { PayoutPaymentMethodOption, PayoutSellerOption } from "@/types/payouts";

type PayoutsCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountLabel: string;
  accountExternalId: string;
  sellers: PayoutSellerOption[];
  canManage: boolean;
  selectedSellerId?: string;
  onSelectedSellerIdChange: (sellerId: string) => void;
  availableForPayoutCents: number;
  isAvailableBalanceLoading: boolean;
  isAvailableBalanceError: boolean;
  paymentMethods: PayoutPaymentMethodOption[];
  isPaymentMethodsLoading: boolean;
  isPaymentMethodsError: boolean;
  isPending: boolean;
  onSubmit: (payload: CreatePayoutPayload) => void;
  showTrigger?: boolean;
  triggerLabel?: string;
};

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return NaN;
  return Number(normalized);
}

function toCents(value: string): number {
  const parsed = parseDecimalInput(value);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100);
}

function formatCentsForInput(value: number): string {
  return (value / 100).toFixed(2);
}

function paymentMethodLabel(methodType: "binance" | "airtm" | "bank_qr"): string {
  if (methodType === "bank_qr") return "Bank QR";
  return methodType === "airtm" ? "Airtm" : "Binance";
}

export function PayoutsCreateDialog({
  open,
  onOpenChange,
  accountLabel,
  accountExternalId,
  sellers,
  canManage,
  selectedSellerId,
  onSelectedSellerIdChange,
  availableForPayoutCents,
  isAvailableBalanceLoading,
  isAvailableBalanceError,
  paymentMethods,
  isPaymentMethodsLoading,
  isPaymentMethodsError,
  isPending,
  onSubmit,
  showTrigger = true,
  triggerLabel = "Retirar",
}: PayoutsCreateDialogProps) {
  const [formAmount, setFormAmount] = useState("");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formPlatformFee, setFormPlatformFee] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const amountCents = toCents(formAmount);
  const exceedsAvailableBalance =
    Number.isFinite(amountCents) &&
    amountCents > 0 &&
    amountCents > availableForPayoutCents;

  const resetForm = () => {
    setFormAmount("");
    setFormPaymentMethodId("");
    setFormPlatformFee("");
    setFormReference("");
    setFormNotes("");
  };

  useEffect(() => {
    if (!selectedSellerId) {
      setFormPaymentMethodId("");
      return;
    }
    if (paymentMethods.length === 0) {
      setFormPaymentMethodId("");
      return;
    }
    if (paymentMethods.some((method) => method.id === formPaymentMethodId)) return;
    const preferredMethod = paymentMethods.find((method) => method.is_default) ?? paymentMethods[0];
    setFormPaymentMethodId(preferredMethod.id);
  }, [formPaymentMethodId, paymentMethods, selectedSellerId]);

  const handleSubmit = () => {
    const platformFeeCents = toCents(formPlatformFee || "0");
    if (
      !selectedSellerId ||
      !formPaymentMethodId ||
      !Number.isFinite(amountCents) ||
      amountCents <= 0 ||
      exceedsAvailableBalance
    ) {
      return;
    }

    onSubmit({
      userId: selectedSellerId,
      accountExternalId,
      amount: amountCents,
      paymentMethodId: formPaymentMethodId,
      platformFee: Math.max(0, Number.isFinite(platformFeeCents) ? platformFeeCents : 0),
      reference: formReference,
      notes: formNotes,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          resetForm();
          if (canManage) onSelectedSellerIdChange("");
        }
      }}
    >
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button>{triggerLabel}</Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Retirar</DialogTitle>
          <DialogDescription>
            Crea un payout pendiente para {accountLabel} ({accountExternalId}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(90vh-10rem)] sm:max-h-[calc(85vh-10rem)]">
          {canManage ? (
            <div className="space-y-2">
              <Label htmlFor={`create-payout-seller-${accountExternalId}`}>Usuario</Label>
              <Select
                value={selectedSellerId ?? ""}
                onValueChange={onSelectedSellerIdChange}
              >
                <SelectTrigger className="w-full" id={`create-payout-seller-${accountExternalId}`}>
                  <SelectValue placeholder="Selecciona usuario" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name || seller.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`create-payout-amount-${accountExternalId}`}>Monto (USD)</Label>
            <Input
              type="text"
              id={`create-payout-amount-${accountExternalId}`}
              inputMode="decimal"
              placeholder="100.00"
              value={formAmount}
              onChange={(event) => setFormAmount(event.target.value)}
            />
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="text-muted-foreground">
                {selectedSellerId
                  ? isAvailableBalanceLoading
                    ? "Cargando saldo disponible..."
                    : `Saldo disponible: ${formatUsdFromCents(availableForPayoutCents)}`
                  : "Selecciona un usuario para ver su saldo disponible"}
              </p>
              {selectedSellerId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    isAvailableBalanceLoading ||
                    isAvailableBalanceError ||
                    availableForPayoutCents <= 0
                  }
                  onClick={() => setFormAmount(formatCentsForInput(availableForPayoutCents))}
                >
                  Retirar todo
                </Button>
              ) : null}
            </div>
            {exceedsAvailableBalance ? (
              <p className="text-xs text-destructive">
                El monto a retirar no puede ser mayor al saldo disponible.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`create-payout-method-${accountExternalId}`}>Método</Label>
            <Select
              value={formPaymentMethodId}
              onValueChange={setFormPaymentMethodId}
              disabled={!selectedSellerId || isPaymentMethodsLoading || paymentMethods.length === 0}
            >
              <SelectTrigger className="w-full" id={`create-payout-method-${accountExternalId}`}>
                <SelectValue
                  placeholder={
                    !selectedSellerId
                      ? "Selecciona usuario primero"
                      : isPaymentMethodsLoading
                        ? "Cargando métodos..."
                        : "Selecciona método"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {paymentMethodLabel(method.method_type)}
                    {method.is_default ? " (Predeterminado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSellerId && !isPaymentMethodsLoading && paymentMethods.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tiene métodos de pago habilitados.{" "}
                <Link
                  href="/admin/settings/payment-methods"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Configurar métodos de pago
                </Link>
                .
              </p>
            ) : null}
            {selectedSellerId && isPaymentMethodsError ? (
              <p className="text-xs text-destructive">
                No se pudieron cargar los métodos de pago del usuario.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`create-payout-notes-${accountExternalId}`}>Notas (opcional)</Label>
            <Textarea
              id={`create-payout-notes-${accountExternalId}`}
              value={formNotes}
              onChange={(event) => setFormNotes(event.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedSellerId ||
              !formPaymentMethodId ||
              !formAmount ||
              isPending ||
              exceedsAvailableBalance
            }
          >
            {isPending ? <Spinner /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
