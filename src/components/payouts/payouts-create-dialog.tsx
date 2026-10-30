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
import { createClient } from "@/lib/supabase/client";
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
  const payoutFormBodyScrollRef = useRef<HTMLDivElement>(null);
  const withdrawableSentinelRef = useRef<HTMLLIElement>(null);
  const [accountRequiresFunds, setAccountRequiresFunds] = useState<boolean>(true);

  const withdrawableQuery = useInfiniteWithdrawablePayoutTransactions(
    selectedSellerId,
    accountExternalId,
    open && Boolean(selectedSellerId),
  );

  const withdrawablePages = useMemo(() => withdrawableQuery.data?.pages ?? [], [withdrawableQuery.data]);
  const payoutTransactionRows = useMemo(
    () => withdrawablePages.flatMap((pageData) => pageData.rows),
    [withdrawablePages],
  );
  const payoutTransactionsTotal = withdrawablePages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = withdrawableQuery;

  const eligibleRowsLoaded = useMemo(
    () => payoutTransactionRows.filter((row) => row.eligible_for_payout),
    [payoutTransactionRows],
  );

  const selectedTotalCents = useMemo(() => {
    let sum = 0;
    for (const row of payoutTransactionRows) {
      if (selectedTxIds.has(row.id) && row.eligible_for_payout) sum += row.commission_amount;
    }
    return sum;
  }, [payoutTransactionRows, selectedTxIds]);

  const platformFeeCents = toCents(formPlatformFee || "0");
  const normalizedPlatformFee = Number.isFinite(platformFeeCents) ? Math.max(0, platformFeeCents) : 0;

  useEffect(() => {
    const loadAccountProps = async () => {
      const supabase = createClient();
      const { data: account } = await supabase
        .from("stripe_accounts")
        .select("requires_funds_available, admin_only_payouts")
        .eq("stripe_account_external_id", accountExternalId)
        .maybeSingle();
      setAccountRequiresFunds(account?.requires_funds_available ?? true);
    };
    void loadAccountProps();
  }, [accountExternalId]);

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
    const root = payoutFormBodyScrollRef.current;
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, payoutTransactionRows.length]);

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
    (txId: string, commission: number, checked: boolean, eligible: boolean) => {
      if (!eligible) return;
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        if (!checked) {
          next.delete(txId);
          return next;
        }
        if (next.has(txId)) return prev;
        let currentSum = 0;
        for (const r of payoutTransactionRows) {
          if (prev.has(r.id) && r.eligible_for_payout) currentSum += r.commission_amount;
        }
        if (currentSum + commission > availableForPayoutCents) return prev;
        next.add(txId);
        return next;
      });
    },
    [availableForPayoutCents, payoutTransactionRows],
  );

  const selectAllUnderCap = useCallback(() => {
    const next = new Set<string>();
    let sum = 0;
    for (const row of payoutTransactionRows) {
      if (!row.eligible_for_payout) continue;
      if (sum + row.commission_amount > availableForPayoutCents) break;
      next.add(row.id);
      sum += row.commission_amount;
    }
    setSelectedTxIds(next);
  }, [payoutTransactionRows, availableForPayoutCents]);

  const greedySelectAllIds = useMemo(() => {
    const ids: string[] = [];
    let sum = 0;
    for (const row of payoutTransactionRows) {
      if (!row.eligible_for_payout) continue;
      if (sum + row.commission_amount > availableForPayoutCents) break;
      ids.push(row.id);
      sum += row.commission_amount;
    }
    return ids;
  }, [payoutTransactionRows, availableForPayoutCents]);

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

    const stripeTransactionIds = payoutTransactionRows
      .filter((row) => selectedTxIds.has(row.id) && row.eligible_for_payout)
      .map((row) => row.id);
    if (stripeTransactionIds.length === 0) return;

    onSubmit({
      userId: selectedSellerId,
      accountExternalId,
      stripeTransactionIds,
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
      <DialogContent className="flex min-h-0 w-full flex-col gap-0 overflow-hidden max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] sm:max-h-[85vh] supports-[height:100dvh]:sm:max-h-[85dvh]">
        <DialogHeader className="shrink-0 pb-4 text-left">
          <DialogTitle>Retirar</DialogTitle>
          <DialogDescription>
            Selecciona las transacciones cuya comisión incluir en el retiro para {accountLabel} (
            {accountExternalId}).
          </DialogDescription>
        </DialogHeader>

        <div
          ref={payoutFormBodyScrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain pr-1"
        >
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
                    ? accountRequiresFunds
                      ? "Cargando tope de retiro..."
                      : "Cargando saldo disponible..."
                    : accountRequiresFunds
                      ? `Máximo retirable: ${formatUsdFromCents(availableForPayoutCents)}`
                      : `Saldo disponible: ${formatUsdFromCents(availableForPayoutCents)}`
                  : accountRequiresFunds
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
                <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {eligibleRowsLoaded.length > 0 ? (
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
                        aria-label="Seleccionar o quitar todas las transacciones elegibles cargadas dentro del tope"
                        className="mt-0.5"
                      />
                    ) : null}
                    <Label
                      htmlFor={
                        eligibleRowsLoaded.length > 0
                          ? `payout-withdrawable-select-all-${accountExternalId}`
                          : undefined
                      }
                      className={
                        eligibleRowsLoaded.length > 0 ? "cursor-pointer font-normal" : "font-normal"
                      }
                    >
                      Transacciones del vendedor
                    </Label>
                  </div>
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
              ) : payoutTransactionRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay transacciones asignadas a este vendedor en esta cuenta.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payoutTransactionRows.map((row) => {
                    const checked = selectedTxIds.has(row.id);
                    const eligible = row.eligible_for_payout;
                    const wouldExceed =
                      eligible &&
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
                          disabled={!eligible || (wouldExceed && !checked)}
                          onCheckedChange={(value) =>
                            toggleTransaction(row.id, row.commission_amount, value === true, eligible)
                          }
                          className="mt-1"
                        />
                        <label
                          htmlFor={eligible ? `payout-tx-${row.id}` : undefined}
                          className={`min-w-0 flex-1 ${eligible ? "cursor-pointer" : "cursor-default opacity-90"}`}
                        >
                          <span className="font-mono text-xs">{row.stripe_id}</span>
                          <span className="block text-muted-foreground text-xs">
                            {formatDateTime(row.stripe_created_at)} ·{" "}
                            {row.customer_name || "Sin nombre"} ·{" "}
                            {formatUsdFromCents(row.commission_amount)}
                          </span>
                          {eligible ? null : (
                            <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-500">
                              {row.ineligibility_reason ?? "No elegible para retiro"}
                            </span>
                          )}
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
              {payoutTransactionsTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {payoutTransactionRows.length === payoutTransactionsTotal
                    ? `${payoutTransactionsTotal} transacción${payoutTransactionsTotal === 1 ? "" : "es"} asignada${payoutTransactionsTotal === 1 ? "" : "s"}`
                    : `${payoutTransactionRows.length} de ${payoutTransactionsTotal} mostradas`}
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

        <DialogFooter className="shrink-0 gap-3 border-t pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] sm:border-t-0 sm:pt-2">
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
