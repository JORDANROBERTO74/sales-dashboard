"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatUsdFromCents } from "@/lib/transactions/formatters";
import type { PayoutRow } from "@/types/payouts";

type PayoutsCompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PayoutRow;
  isPending: boolean;
  onSubmit: (payload: {
    status: "completed";
    platformFee: number;
    exchangeRateBob?: number;
    reference?: string;
    notes?: string;
  }) => void;
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

export function PayoutsCompleteDialog({
  open,
  onOpenChange,
  row,
  isPending,
  onSubmit,
}: PayoutsCompleteDialogProps) {
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [exchangeRateInput, setExchangeRateInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const isBankQrPayout = row.payout_method === "bank_qr";

  useEffect(() => {
    if (!open) return;
    const currentReceivedAmount = Math.max(0, row.amount - row.platform_fee);
    setReceivedAmountInput(formatCentsForInput(currentReceivedAmount));
    setExchangeRateInput(
      row.exchange_rate_bob && Number.isFinite(row.exchange_rate_bob)
        ? String(row.exchange_rate_bob)
        : "",
    );
    setReferenceInput(row.reference ?? "");
    setNotesInput(row.notes ?? "");
  }, [open, row.amount, row.exchange_rate_bob, row.notes, row.platform_fee, row.reference]);

  const receivedAmountCents = toCents(receivedAmountInput);
  const normalizedReceivedAmount = Number.isFinite(receivedAmountCents)
    ? Math.max(0, receivedAmountCents)
    : NaN;
  const exceedsAmount =
    Number.isFinite(normalizedReceivedAmount) && normalizedReceivedAmount > row.amount;
  const isReceivedAmountInvalid =
    !receivedAmountInput.trim() || !Number.isFinite(normalizedReceivedAmount);
  const parsedExchangeRate = parseDecimalInput(exchangeRateInput);
  const normalizedExchangeRateInput = exchangeRateInput.trim().replace(",", ".");
  const isExchangeRatePrecisionInvalid =
    isBankQrPayout &&
    normalizedExchangeRateInput.length > 0 &&
    !/^\d+(\.\d{1,6})?$/.test(normalizedExchangeRateInput);
  const isExchangeRateInvalid =
    isBankQrPayout &&
    (!exchangeRateInput.trim() ||
      !Number.isFinite(parsedExchangeRate) ||
      parsedExchangeRate <= 0 ||
      isExchangeRatePrecisionInvalid);
  const referenceTooLong = referenceInput.length > 200;
  const notesTooLong = notesInput.length > 500;
  const canSubmit =
    !isPending &&
    !isReceivedAmountInvalid &&
    !isExchangeRateInvalid &&
    !exceedsAmount &&
    !referenceTooLong &&
    !notesTooLong;

  const derivedPlatformFee = useMemo(() => {
    if (!Number.isFinite(normalizedReceivedAmount)) return 0;
    return Math.max(0, row.amount - normalizedReceivedAmount);
  }, [normalizedReceivedAmount, row.amount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Completar payout</DialogTitle>
          <DialogDescription>
            Se actualizara este payout a estado completado y se guardaran los datos operativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="font-medium">{formatUsdFromCents(row.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee estimado</p>
              <p className="font-medium">{formatUsdFromCents(derivedPlatformFee)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`complete-payout-received-${row.id}`}>Monto recibido (USD)</Label>
            <Input
              id={`complete-payout-received-${row.id}`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={receivedAmountInput}
              onChange={(event) => setReceivedAmountInput(event.target.value)}
            />
            {isReceivedAmountInvalid ? (
              <p className="text-xs text-destructive">
                Ingresa un monto recibido valido mayor o igual a 0.
              </p>
            ) : null}
            {exceedsAmount ? (
              <p className="text-xs text-destructive">
                El monto recibido no puede ser mayor al monto total del payout.
              </p>
            ) : null}
          </div>
          {isBankQrPayout ? (
            <div className="space-y-2">
              <Label htmlFor={`complete-payout-exchange-rate-${row.id}`}>Tipo de cambio (Bs/USD)</Label>
              <Input
                id={`complete-payout-exchange-rate-${row.id}`}
                type="text"
                inputMode="decimal"
                placeholder="6.96"
                value={exchangeRateInput}
                onChange={(event) => setExchangeRateInput(event.target.value)}
              />
              {isExchangeRateInvalid ? (
                <p className="text-xs text-destructive">
                  Ingresa un tipo de cambio valido mayor a 0 (hasta 6 decimales) para completar payout Bank QR.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`complete-payout-reference-${row.id}`}>Referencia (opcional)</Label>
            <Input
              id={`complete-payout-reference-${row.id}`}
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder="ID externo o comprobante"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{referenceInput.length}/200</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`complete-payout-notes-${row.id}`}>Notas (opcional)</Label>
            <Textarea
              id={`complete-payout-notes-${row.id}`}
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{notesInput.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                status: "completed",
                platformFee: derivedPlatformFee,
                exchangeRateBob: isBankQrPayout ? parsedExchangeRate : undefined,
                reference: referenceInput.trim() || undefined,
                notes: notesInput.trim() || undefined,
              })
            }
          >
            {isPending ? <Spinner /> : null}
            Completar payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
