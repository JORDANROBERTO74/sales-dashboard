"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useInfiniteWithdrawablePayoutTransactions } from "@/hooks/payouts/use-payouts";
import { formatDateTime, formatUsdFromCents } from "@/lib/transactions/formatters";
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
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(() => new Set());
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formPlatformFee, setFormPlatformFee] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const withdrawableListScrollRef = useRef<HTMLUListElement>(null);
  const withdrawableSentinelRef = useRef<HTMLLIElement>(null);

  const withdrawableQuery = useInfiniteWithdrawablePayoutTransactions(
    selectedSellerId,
    accountExternalId,
    open && Boolean(selectedSellerId),
  );

  const withdrawablePages = useMemo(() => withdrawableQuery.data?.pages ?? [], [withdrawableQuery.data]);
  const withdrawableRows = useMemo(
    () => withdrawablePages.flatMap((pageData) => pageData.rows),
    [withdrawablePages],
  );
  const withdrawableTotal = withdrawablePages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = withdrawableQuery;

  const selectedTotalCents = useMemo(() => {
    let sum = 0;
    for (const row of withdrawableRows) {
      if (selectedTxIds.has(row.id)) sum += row.commission_amount;
    }
    return sum;
  }, [withdrawableRows, selectedTxIds]);

  const platformFeeCents = toCents(formPlatformFee || "0");
  const normalizedPlatformFee = Number.isFinite(platformFeeCents) ? Math.max(0, platformFeeCents) : 0;

  const isVascruzAccount = accountExternalId === "acct_vascruz";
  const exceedsAvailableBalance =
    selectedTotalCents > 0 && selectedTotalCents > availableForPayoutCents;
  const platformFeeExceedsAmount = normalizedPlatformFee > selectedTotalCents;

  const resetForm = () => {
    setSelectedTxIds(new Set());
    setFormPaymentMethodId("");
    setFormPlatformFee("");
    setFormReference("");
    setFormNotes("");
  };

  useEffect(() => {
    setSelectedTxIds(new Set());
  }, [selectedSellerId, accountExternalId]);

  useEffect(() => {
    const root = withdrawableListScrollRef.current;
    const target = withdrawableSentinelRef.current;
    if (!root || !target || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasNextPage || isFetchingNextPage) return;
        void fetchNextPage();
      },
      { root, rootMargin: "0px 0px 120px 0px", threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, withdrawableRows.length]);

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

  const toggleTransaction = useCallback(
    (txId: string, commission: number, checked: boolean) => {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        if (!checked) {
          next.delete(txId);
          return next;
        }
        if (next.has(txId)) return prev;
        let currentSum = 0;
        for (const r of withdrawableRows) {
          if (prev.has(r.id)) currentSum += r.commission_amount;
        }
        if (currentSum + commission > availableForPayoutCents) return prev;
        next.add(txId);
        return next;
      });
    },
    [availableForPayoutCents, withdrawableRows],
  );

  const selectAllUnderCap = useCallback(() => {
    const next = new Set<string>();
    let sum = 0;
    for (const row of withdrawableRows) {
      if (sum + row.commission_amount > availableForPayoutCents) break;
      next.add(row.id);
      sum += row.commission_amount;
    }
    setSelectedTxIds(next);
  }, [withdrawableRows, availableForPayoutCents]);

  const greedySelectAllIds = useMemo(() => {
    const ids: string[] = [];
    let sum = 0;
    for (const row of withdrawableRows) {
      if (sum + row.commission_amount > availableForPayoutCents) break;
      ids.push(row.id);
      sum += row.commission_amount;
    }
    return ids;
  }, [withdrawableRows, availableForPayoutCents]);

  const withdrawableSelectAllChecked =
    greedySelectAllIds.length > 0 &&
    greedySelectAllIds.length === selectedTxIds.size &&
    greedySelectAllIds.every((id) => selectedTxIds.has(id));

  const withdrawableSelectAllIndeterminate =
    selectedTxIds.size > 0 && !withdrawableSelectAllChecked;

  const withdrawableSelectAllDisabled =
    isAvailableBalanceLoading ||
    isAvailableBalanceError ||
    availableForPayoutCents <= 0 ||
    withdrawableQuery.isPending ||
    greedySelectAllIds.length === 0;

  const handleSubmit = () => {
    if (
      !selectedSellerId ||
      !formPaymentMethodId ||
      selectedTxIds.size === 0 ||
      selectedTotalCents <= 0 ||
      exceedsAvailableBalance ||
      platformFeeExceedsAmount
    ) {
      return;
    }

    onSubmit({
      userId: selectedSellerId,
      accountExternalId,
      stripeTransactionIds: Array.from(selectedTxIds),
      paymentMethodId: formPaymentMethodId,
      platformFee: normalizedPlatformFee,
      reference: formReference.trim() || undefined,
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
            Selecciona las transacciones cuya comisión incluir en el retiro para {accountLabel} (
            {accountExternalId}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(90vh-10rem)] sm:max-h-[calc(85vh-10rem)]">
          {canManage ? (
            <div className="space-y-2">
              <Label htmlFor={`create-payout-seller-${accountExternalId}`}>Usuario</Label>
              <Select value={selectedSellerId ?? ""} onValueChange={onSelectedSellerIdChange}>
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
              readOnly
              className="bg-muted"
              value={selectedTotalCents > 0 ? formatUsdFromCents(selectedTotalCents) : ""}
              placeholder="0.00"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="text-muted-foreground">
                {selectedSellerId
                  ? isAvailableBalanceLoading
                    ? isVascruzAccount
                      ? "Cargando tope de retiro..."
                      : "Cargando saldo disponible..."
                    : isVascruzAccount
                      ? `Máximo retirable (Vascruz): ${formatUsdFromCents(availableForPayoutCents)}`
                      : `Saldo disponible: ${formatUsdFromCents(availableForPayoutCents)}`
                  : isVascruzAccount
                    ? "Selecciona un usuario para ver el máximo retirable"
                    : "Selecciona un usuario para ver su saldo disponible"}
              </p>
            </div>
            {exceedsAvailableBalance ? (
              <p className="text-xs text-destructive">
                La suma de comisiones seleccionadas supera el saldo disponible.
              </p>
            ) : null}
            {platformFeeExceedsAmount ? (
              <p className="text-xs text-destructive">
                El fee de plataforma no puede ser mayor al monto del retiro.
              </p>
            ) : null}
          </div>

          {selectedSellerId ? (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {withdrawableRows.length > 0 ? (
                    <Checkbox
                      id={`payout-withdrawable-select-all-${accountExternalId}`}
                      checked={
                        withdrawableSelectAllIndeterminate ? "indeterminate" : withdrawableSelectAllChecked
                      }
                      disabled={withdrawableSelectAllDisabled}
                      onCheckedChange={(value) => {
                        if (value === true) selectAllUnderCap();
                        else setSelectedTxIds(new Set());
                      }}
                      aria-label="Seleccionar o quitar todas las transacciones cargadas dentro del tope"
                      className="mt-0.5"
                    />
                  ) : null}
                  <Label
                    htmlFor={
                      withdrawableRows.length > 0
                        ? `payout-withdrawable-select-all-${accountExternalId}`
                        : undefined
                    }
                    className={withdrawableRows.length > 0 ? "cursor-pointer font-normal" : undefined}
                  >
                    Transacciones disponibles para retiro
                  </Label>
                </div>
                {withdrawableQuery.isFetching ? (
                  <span className="inline-flex size-4 items-center justify-center shrink-0">
                    <Spinner />
                  </span>
                ) : null}
              </div>
              {withdrawableQuery.isError ? (
                <p className="text-xs text-destructive">No se pudo cargar el listado de transacciones.</p>
              ) : withdrawableQuery.isPending ? (
                <p className="text-xs text-muted-foreground">Cargando transacciones...</p>
              ) : withdrawableRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay transacciones con comisión retirable (estado vacío, fondos liberados según cuenta).
                </p>
              ) : (
                <ul
                  ref={withdrawableListScrollRef}
                  className="max-h-48 space-y-2 overflow-y-auto text-sm"
                >
                  {withdrawableRows.map((row) => {
                    const checked = selectedTxIds.has(row.id);
                    const wouldExceed =
                      !checked &&
                      selectedTotalCents + row.commission_amount > availableForPayoutCents;
                    return (
                      <li
                        key={row.id}
                        className="flex items-start gap-2 rounded-sm border border-transparent px-1 py-0.5 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`payout-tx-${row.id}`}
                          checked={checked}
                          disabled={wouldExceed && !checked}
                          onCheckedChange={(value) =>
                            toggleTransaction(row.id, row.commission_amount, value === true)
                          }
                          className="mt-1"
                        />
                        <label htmlFor={`payout-tx-${row.id}`} className="min-w-0 flex-1 cursor-pointer">
                          <span className="font-mono text-xs">{row.stripe_id}</span>
                          <span className="block text-muted-foreground text-xs">
                            {formatDateTime(row.stripe_created_at)} ·{" "}
                            {row.customer_name || "Sin nombre"} ·{" "}
                            {formatUsdFromCents(row.commission_amount)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                  {hasNextPage ? (
                    <li
                      ref={withdrawableSentinelRef}
                      className="flex min-h-4 list-none items-center justify-center py-1"
                      aria-hidden
                    >
                      {isFetchingNextPage ? (
                        <span className="inline-flex size-4 items-center justify-center">
                          <Spinner />
                        </span>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
              )}
              {withdrawableTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {withdrawableRows.length === withdrawableTotal
                    ? `${withdrawableTotal} transacción${withdrawableTotal === 1 ? "" : "es"} elegible${withdrawableTotal === 1 ? "" : "s"}`
                    : `${withdrawableRows.length} de ${withdrawableTotal} cargadas`}
                  {hasNextPage ? " · Desplázate hacia abajo para cargar más" : ""}
                </p>
              ) : null}
            </div>
          ) : null}

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

        <DialogFooter className="mb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedSellerId ||
              !formPaymentMethodId ||
              selectedTxIds.size === 0 ||
              selectedTotalCents <= 0 ||
              isPending ||
              exceedsAvailableBalance ||
              platformFeeExceedsAmount
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
