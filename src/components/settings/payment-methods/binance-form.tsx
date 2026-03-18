"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
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

const binanceSchema = z.object({
  binanceId: z.string().min(2, "ID de Binance requerido"),
  binanceQrImageUrl: z.string().optional(),
  isEnabled: z.boolean(),
});

type BinanceValues = z.infer<typeof binanceSchema>;

type BinanceFormProps = {
  existing?: SellerPaymentMethod;
  onSaved?: () => void;
};

export function BinanceForm({ existing, onSaved }: BinanceFormProps) {
  const upsertMutation = useUpsertPaymentMethod();
  const uploadQrMutation = useUploadPaymentQr();
  const [uploadedPreview, setUploadedPreview] = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const form = useForm<BinanceValues>({
    resolver: zodResolver(binanceSchema),
    defaultValues: {
      binanceId: existing?.binance_id ?? "",
      binanceQrImageUrl: existing?.binance_qr_image_url ?? "",
      isEnabled: existing?.is_enabled ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      binanceId: existing?.binance_id ?? "",
      binanceQrImageUrl: existing?.binance_qr_image_url ?? "",
      isEnabled: existing?.is_enabled ?? true,
    });
    setUploadedPreview(existing?.binance_qr_image_signed_url ?? "");
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

  const watchedQrImageUrl = form.watch("binanceQrImageUrl");
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
    event.currentTarget.value = "";
  };

  const onClearQr = () => {
    if (localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }
    setSelectedQrFile(null);
    setLocalPreview("");
    form.setValue("binanceQrImageUrl", "", { shouldDirty: true, shouldValidate: true });
    setUploadedPreview("");
  };

  const onSubmit = async (values: BinanceValues) => {
    try {
      let binanceQrImageUrl = values.binanceQrImageUrl || null;

      if (selectedQrFile) {
        const uploaded = await uploadQrMutation.mutateAsync(selectedQrFile);
        binanceQrImageUrl = uploaded.path;
        setUploadedPreview(uploaded.signedUrl);
        if (localPreview.startsWith("blob:")) {
          URL.revokeObjectURL(localPreview);
        }
        setLocalPreview("");
        setSelectedQrFile(null);
      }

      await upsertMutation.mutateAsync({
        methodType: "binance",
        binanceId: values.binanceId,
        binanceQrImageUrl,
        isEnabled: values.isEnabled,
      });
      onSaved?.();
    } catch {
      // Errors are handled by mutation hooks.
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Controller
        name="binanceId"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="binance-id">ID de Binance</Label>
            <Input id="binance-id" autoComplete="off" {...field} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="binanceQrImageUrl"
        control={form.control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Label htmlFor="binance-qr-file">Código QR</Label>
            <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-3">
              <Input
                id="binance-qr-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onUploadQr}
                disabled={uploadQrMutation.isPending}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Formatos permitidos: PNG, JPG o WEBP.
              </p>
              {selectedQrFile && !uploadQrMutation.isPending ? (
                <p className="text-xs text-amber-600">La imagen se subirá cuando guardes.</p>
              ) : null}

              {uploadQrMutation.isPending ? (
                <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  Subiendo código QR...
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
                  <Image
                    src={previewUrl}
                    alt="Vista previa de código QR Binance"
                    width={352}
                    height={176}
                    unoptimized
                    className="h-44 w-full rounded-md object-contain bg-muted/30"
                  />
                </div>
              ) : hasStoredQr ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Ya existe un código QR guardado para Binance.</span>
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
                El método se podrá usar para retiros cuando esté activo.
              </p>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Habilitar método Binance"
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
          {upsertMutation.isPending ? "Guardando..." : "Guardar Binance"}
        </Button>
      </div>
    </form>
  );
}
