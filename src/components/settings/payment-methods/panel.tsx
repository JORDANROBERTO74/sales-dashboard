"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import {
  PaymentMethodType,
  SellerPaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useSetDefaultPaymentMethod,
} from "@/hooks/settings/use-payment-methods";
import { BinanceForm } from "@/components/settings/payment-methods/binance-form";
import { AirtmForm } from "@/components/settings/payment-methods/airtm-form";
import { BankQrForm } from "@/components/settings/payment-methods/bank-qr-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { toast } from "sonner";

function findMethod(
  methods: SellerPaymentMethod[] | undefined,
  methodType: SellerPaymentMethod["method_type"]
) {
  return (methods ?? []).find((method) => method.method_type === methodType);
}

function getMethodLabel(methodType: SellerPaymentMethod["method_type"]) {
  switch (methodType) {
    case "binance":
      return "Binance";
    case "airtm":
      return "Airtm";
    case "bank_qr":
      return "Banco QR";
    default:
      return methodType;
  }
}

const PAYMENT_METHOD_OPTIONS: Array<{
  type: PaymentMethodType;
  label: string;
  description: string;
}> = [
    {
      type: "binance",
      label: "Binance",
      description: "Configura tu ID de Binance y código QR para recibir pagos.",
    },
    {
      type: "airtm",
      label: "Airtm",
      description: "Configura tu cuenta ACH para retiros en USD.",
    },
    {
      type: "bank_qr",
      label: "Banco QR",
      description: "Configura datos bancarios para retiros locales.",
    },
  ];

function getTutorialPath(methodType: PaymentMethodType) {
  switch (methodType) {
    case "binance":
      return "/payment-methods/binance";
    case "airtm":
      return "/payment-methods/airtm";
    case "bank_qr":
      return "/payment-methods/banco-qr";
    default:
      return "/payment-methods";
  }
}

export function PaymentMethodsPanel() {
  const queryClient = useQueryClient();
  const methodsQuery = usePaymentMethods();
  const patchMethodMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const response = await fetch(`/api/settings/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      const data = (await response.json()) as { error?: string; error_code?: string };
      if (!response.ok) {
        if (data.error_code) {
          throw new Error(`${data.error_code}::${data.error || "Error de servidor"}`);
        }
        throw new Error(data.error || "Error de servidor");
      }
      return { isEnabled };
    },
    onMutate: async ({ id, isEnabled }) => {
      await queryClient.cancelQueries({ queryKey: ["settings", "payment-methods"] });

      const previousMethods = queryClient.getQueryData<SellerPaymentMethod[]>([
        "settings",
        "payment-methods",
      ]);

      queryClient.setQueryData<SellerPaymentMethod[]>(
        ["settings", "payment-methods"],
        (current = []) =>
          current.map((method) =>
            method.id === id ? { ...method, is_enabled: isEnabled } : method
          )
      );

      return { previousMethods };
    },
    onSuccess: async ({ isEnabled }) => {
      toast.success(isEnabled ? "Método habilitado" : "Método inhabilitado");
    },
    onError: (error, _variables, context) => {
      if (context?.previousMethods) {
        queryClient.setQueryData(["settings", "payment-methods"], context.previousMethods);
      }
      toast.error("No se pudo actualizar el método", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
  const setDefaultMutation = useSetDefaultPaymentMethod();
  const deleteMutation = useDeletePaymentMethod();
  const [openDialogMethodType, setOpenDialogMethodType] = useState<PaymentMethodType | null>(null);
  const [defaultingMethodId, setDefaultingMethodId] = useState<string | null>(null);
  const [deletingMethodId, setDeletingMethodId] = useState<string | null>(null);
  const [switchingMethodId, setSwitchingMethodId] = useState<string | null>(null);

  const binance = useMemo(
    () => findMethod(methodsQuery.data, "binance"),
    [methodsQuery.data]
  );
  const airtm = useMemo(() => findMethod(methodsQuery.data, "airtm"), [methodsQuery.data]);
  const bankQr = useMemo(
    () => findMethod(methodsQuery.data, "bank_qr"),
    [methodsQuery.data]
  );
  const methodsByType = useMemo(
    () => ({
      binance,
      airtm,
      bank_qr: bankQr,
    }),
    [airtm, bankQr, binance]
  );

  const existingMethods = (methodsQuery.data ?? []).filter((method) => method.id);
  const isDialogOpen = openDialogMethodType !== null;

  const renderDialogForm = () => {
    const onSaved = () => setOpenDialogMethodType(null);

    if (openDialogMethodType === "binance") {
      return <BinanceForm existing={binance} onSaved={onSaved} />;
    }
    if (openDialogMethodType === "airtm") {
      return <AirtmForm existing={airtm} onSaved={onSaved} />;
    }
    if (openDialogMethodType === "bank_qr") {
      return <BankQrForm existing={bankQr} onSaved={onSaved} />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Métodos de pago</CardTitle>
          <CardDescription>
            Administra qué métodos están configurados, habilitados y cuál es el predeterminado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methodsQuery.isLoading ? (
            <SettingsSectionSkeleton rows={2} showHeader={false} />
          ) : methodsQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(methodsQuery.error)}
              onRetry={() => {
                void methodsQuery.refetch();
              }}
            />
          ) : (
            <>
              {existingMethods.length === 0 ? (
                <SettingsEmptyState
                  title="Aun no tienes metodos configurados."
                  description="Configura al menos un metodo para recibir pagos y retiros."
                />
              ) : null}

              {PAYMENT_METHOD_OPTIONS.map((item) => {
                const method = methodsByType[item.type];
                const isConfigured = Boolean(method?.id);
                const isSwitchPending = method?.id
                  ? switchingMethodId === method.id
                  : false;

                return (
                  <div key={item.type} className="space-y-3 rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium">{item.label}</div>
                        {method?.id ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-full"
                                  disabled={defaultingMethodId === method.id || method?.is_default}
                                  aria-label={
                                    method?.is_default
                                      ? `${item.label} es el método predeterminado`
                                      : `Marcar ${item.label} como método predeterminado`
                                  }
                                  onClick={() => {
                                    setDefaultingMethodId(method.id);
                                    setDefaultMutation.mutate(method.id, {
                                      onSettled: () => setDefaultingMethodId(null),
                                    });
                                  }}
                                >
                                  {defaultingMethodId === method.id ? (
                                    <Spinner />
                                  ) : (
                                    <Star
                                      className={
                                        method?.is_default
                                          ? "size-4 fill-current text-amber-500"
                                          : "size-4 text-muted-foreground"
                                      }
                                    />
                                  )}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {method?.is_default
                                ? "Método predeterminado"
                                : "Marcar como predeterminado"}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Habilitar</span>
                        <Switch
                          checked={method?.is_enabled ?? false}
                          disabled={isSwitchPending}
                          aria-label={`Habilitar método ${item.label}`}
                          onCheckedChange={(nextValue) => {
                            if (!method?.id) {
                              toast.info("Primero configura este método de pago");
                              setOpenDialogMethodType(item.type);
                              return;
                            }
                            setSwitchingMethodId(method.id);
                            patchMethodMutation.mutate(
                              {
                                id: method.id,
                                isEnabled: nextValue,
                              },
                              {
                                onSettled: () => {
                                  setSwitchingMethodId(null);
                                },
                              }
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={isConfigured ? "default" : "outline"}>
                            {isConfigured ? "Configurado" : "Sin configurar"}
                          </Badge>
                          <Badge variant={method?.is_enabled ? "default" : "outline"}>
                            {method?.is_enabled ? "Habilitado" : "Inhabilitado"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row">
                        {isConfigured ? (
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setOpenDialogMethodType(item.type)}
                          >
                            Editar
                          </Button>
                        ) : null}
                        {method?.id ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                className="w-full sm:w-auto"
                                disabled={deletingMethodId === method.id}
                              >
                                {deletingMethodId === method.id ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Spinner />
                                    Eliminando...
                                  </span>
                                ) : (
                                  "Eliminar"
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el método y puede afectar retiros pendientes.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setDeletingMethodId(method.id);
                                    deleteMutation.mutate(method.id, {
                                      onSettled: () => setDeletingMethodId(null),
                                    });
                                  }}
                                >
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button variant="outline" className="w-full sm:w-auto" asChild>
                            <Link href={getTutorialPath(item.type)}>Ver tutorial</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setOpenDialogMethodType(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {openDialogMethodType ? `Configurar ${getMethodLabel(openDialogMethodType)}` : ""}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del método y guarda los cambios.
            </DialogDescription>
          </DialogHeader>
          {renderDialogForm()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
