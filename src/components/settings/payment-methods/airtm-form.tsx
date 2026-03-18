"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SellerPaymentMethod, useUpsertPaymentMethod } from "@/hooks/settings/use-payment-methods";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const airtmSchema = z.object({
  achAccountHolder: z.string().min(2, "Titular requerido"),
  achRoutingNumber: z.string().min(5, "Routing requerido"),
  achAccountNumber: z.string().min(4, "Cuenta requerida"),
  achBankName: z.string().min(2, "Banco requerido"),
  achAccountType: z.string().min(2, "Tipo de cuenta requerido"),
  isEnabled: z.boolean(),
});

type AirtmValues = z.infer<typeof airtmSchema>;

type AirtmFormProps = {
  existing?: SellerPaymentMethod;
  onSaved?: () => void;
};

export function AirtmForm({ existing, onSaved }: AirtmFormProps) {
  const upsertMutation = useUpsertPaymentMethod();
  const form = useForm<AirtmValues>({
    resolver: zodResolver(airtmSchema),
    defaultValues: {
      achAccountHolder: existing?.ach_account_holder ?? "",
      achRoutingNumber: existing?.ach_routing_number ?? "",
      achAccountNumber: existing?.ach_account_number ?? "",
      achBankName: existing?.ach_bank_name ?? "",
      achAccountType: existing?.ach_account_type ?? "",
      isEnabled: existing?.is_enabled ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      achAccountHolder: existing?.ach_account_holder ?? "",
      achRoutingNumber: existing?.ach_routing_number ?? "",
      achAccountNumber: existing?.ach_account_number ?? "",
      achBankName: existing?.ach_bank_name ?? "",
      achAccountType: existing?.ach_account_type ?? "",
      isEnabled: existing?.is_enabled ?? true,
    });
  }, [existing, form]);

  const onSubmit = (values: AirtmValues) => {
    upsertMutation.mutate(
      {
        methodType: "airtm",
        achAccountHolder: values.achAccountHolder,
        achRoutingNumber: values.achRoutingNumber,
        achAccountNumber: values.achAccountNumber,
        achBankName: values.achBankName,
        achAccountType: values.achAccountType,
        isEnabled: values.isEnabled,
      },
      {
        onSuccess: () => {
          onSaved?.();
        },
      }
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Controller
        name="achAccountHolder"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="ach-holder">Titular</Label>
            <Input id="ach-holder" autoComplete="name" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="achRoutingNumber"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="ach-routing">Routing number</Label>
            <Input id="ach-routing" inputMode="numeric" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="achAccountNumber"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="ach-account">Account number</Label>
            <Input id="ach-account" inputMode="numeric" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="achBankName"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="ach-bank">Banco</Label>
            <Input id="ach-bank" autoComplete="organization" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="achAccountType"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="ach-type">Tipo de cuenta</Label>
            <Input id="ach-type" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="isEnabled"
        control={form.control}
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Habilitado</p>
              <p className="text-xs text-muted-foreground">
                Disponible para retiros cuando esté activo.
              </p>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Habilitar método Airtm"
            />
          </div>
        )}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={upsertMutation.isPending} className="w-full sm:w-auto">
          {upsertMutation.isPending ? "Guardando..." : "Guardar Airtm"}
        </Button>
      </div>
    </form>
  );
}
