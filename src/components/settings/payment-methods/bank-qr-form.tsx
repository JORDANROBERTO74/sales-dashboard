"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  SellerPaymentMethod,
  useUploadPaymentQr,
  useUpsertPaymentMethod,
} from "@/hooks/settings/use-payment-methods";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const bankQrSchema = z.object({
  qrBankName: z.string().min(2, "Banco requerido"),
  qrAccountHolder: z.string().min(2, "Titular requerido"),
  qrCiNumber: z.string().min(3, "CI requerido"),
  qrAccountNumber: z.string().min(4, "Cuenta requerida"),
  qrImageUrl: z.string().optional(),
  isEnabled: z.boolean(),
});

type BankQrValues = z.infer<typeof bankQrSchema>;

type BankQrFormProps = {
  existing?: SellerPaymentMethod;
  onSaved?: () => void;
};

export function BankQrForm({ existing, onSaved }: BankQrFormProps) {
  const upsertMutation = useUpsertPaymentMethod();
  const uploadQrMutation = useUploadPaymentQr();
  const [uploadedPreview, setUploadedPreview] = useState<string>("");
  const [localPreview, setLocalPreview] = useState<string>("");
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const form = useForm<BankQrValues>({
    resolver: zodResolver(bankQrSchema),
    defaultValues: {
      qrBankName: existing?.qr_bank_name ?? "",
      qrAccountHolder: existing?.qr_account_holder ?? "",
      qrCiNumber: existing?.qr_ci_number ?? "",
      qrAccountNumber: existing?.qr_account_number ?? "",
      qrImageUrl: existing?.qr_image_url ?? "",
      isEnabled: existing?.is_enabled ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      qrBankName: existing?.qr_bank_name ?? "",
      qrAccountHolder: existing?.qr_account_holder ?? "",
      qrCiNumber: existing?.qr_ci_number ?? "",
      qrAccountNumber: existing?.qr_account_number ?? "",
      qrImageUrl: existing?.qr_image_url ?? "",
      isEnabled: existing?.is_enabled ?? true,
    });
    setUploadedPreview(existing?.qr_image_signed_url ?? "");
    setLocalPreview("");
    setSelectedQrFile(null);
  }, [existing, form]);

  useEffect(() => {
    return () => {
      if (localPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const watchedQrImageUrl = form.watch("qrImageUrl");
  const hasStoredQr = Boolean(watchedQrImageUrl);
  const previewUrl = localPreview || uploadedPreview;
  const hasPreviewQr = Boolean(previewUrl);

  const onUploadQr = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }

    setSelectedQrFile(file);
    setLocalPreview(URL.createObjectURL(file));
    // Allow selecting the same file again after this change event.
    event.currentTarget.value = "";
  };

  const onClearQr = () => {
    if (localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }
    setSelectedQrFile(null);
    setLocalPreview("");
    form.setValue("qrImageUrl", "", { shouldDirty: true, shouldValidate: true });
    setUploadedPreview("");
  };

  const onSubmit = async (values: BankQrValues) => {
    try {
      let qrImageUrl = values.qrImageUrl || null;

      if (selectedQrFile) {
        const uploaded = await uploadQrMutation.mutateAsync(selectedQrFile);
        qrImageUrl = uploaded.path;
        setUploadedPreview(uploaded.signedUrl);
        if (localPreview.startsWith("blob:")) {
          URL.revokeObjectURL(localPreview);
        }
        setLocalPreview("");
        setSelectedQrFile(null);
      }

      await upsertMutation.mutateAsync({
        methodType: "bank_qr",
        qrBankName: values.qrBankName,
        qrAccountHolder: values.qrAccountHolder,
        qrCiNumber: values.qrCiNumber,
        qrAccountNumber: values.qrAccountNumber,
        qrImageUrl,
        isEnabled: values.isEnabled,
      });
      onSaved?.();
    } catch {
      // Errors are handled by mutation hooks (toast). Prevent unhandled promise rejections in submit flow.
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Controller
        name="qrBankName"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="qr-bank">Banco</Label>
            <Input id="qr-bank" autoComplete="organization" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="qrAccountHolder"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="qr-holder">Titular</Label>
            <Input id="qr-holder" autoComplete="name" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="qrCiNumber"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="qr-ci">CI</Label>
            <Input id="qr-ci" inputMode="numeric" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="qrAccountNumber"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="qr-account">Número de cuenta</Label>
            <Input id="qr-account" inputMode="numeric" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="qrImageUrl"
        control={form.control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="qr-file">Imagen QR</Label>
            <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-3">
              <Input
                id="qr-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onUploadQr}
                disabled={uploadQrMutation.isPending}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Formatos permitidos: PNG, JPG o WEBP. Se recomienda una imagen cuadrada y nítida.
              </p>
              {selectedQrFile && !uploadQrMutation.isPending ? (
                <p className="text-xs text-amber-600">La imagen se subirá cuando hagas clic en Guardar.</p>
              ) : null}

              {uploadQrMutation.isPending ? (
                <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  Subiendo imagen QR...
                </div>
              ) : hasPreviewQr ? (
                <div className="space-y-2 rounded-md border bg-background p-2">
                  <div className="flex justify-end items-center gap-2">
                    {!selectedQrFile ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a href={previewUrl} target="_blank" rel="noreferrer">
                          Ver imagen
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={onClearQr}>
                      <Trash2 className="h-4 w-4" />
                      Limpiar
                    </Button>
                  </div>
                  <img
                    src={previewUrl}
                    alt="Vista previa de imagen QR"
                    className="h-44 w-full rounded-md object-contain bg-muted/30"
                  />
                </div>
              ) : hasStoredQr ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Ya existe una imagen QR guardada para este método.</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={onClearQr}>
                    <Trash2 className="h-4 w-4" />
                    Limpiar
                  </Button>
                </div>
              ) : null}
            </div>
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
              aria-label="Habilitar método Banco QR"
            />
          </div>
        )}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={upsertMutation.isPending || uploadQrMutation.isPending}
          className="w-full sm:w-auto"
        >
          {upsertMutation.isPending ? "Guardando..." : "Guardar Banco QR"}
        </Button>
      </div>
    </form>
  );
}
