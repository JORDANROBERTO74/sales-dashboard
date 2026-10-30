"use client";

import type { MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { StripePaymentLinkItem } from "@/data/stripe-payment-links";
import { formatListedPrice } from "@/data/stripe-payment-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

type StripePaymentLinkCardProps = {
  item: StripePaymentLinkItem;
  showDuplicateNameHint: boolean;
};

export function StripePaymentLinkCard({
  item,
  showDuplicateNameHint,
}: StripePaymentLinkCardProps) {
  async function handleCopy(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      toast.success("Enlace copiado; ya puedes compartirlo");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  const [Copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!Copied) return;
    setTimeout(() => {
      setCopied(false);
    }, 500);
  }, [Copied, setCopied]);

  const priceLabel = formatListedPrice(item);
  const priceSr =
    item.currency === "bob"
      ? "bolivianos"
      : "dólares estadounidenses";

  return (
    <Card className="relative flex cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* Clic en el cuerpo de la card (ratón); teclado usa "Pagar en Stripe" */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden={true}
        className="absolute inset-0 z-0 rounded-xl outline-none"
      />

      <CardHeader className="relative z-10 space-y-3 pb-2 pt-6 pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="pr-6 text-xl font-semibold leading-snug">
            {item.name}
          </CardTitle>
        </div>

        <div className="space-y-1">
          {priceLabel ? (
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {priceLabel}
              <span className="sr-only"> {priceSr}</span>
            </p>
          ) : (
            <p className="text-lg font-medium text-muted-foreground">
              Ver precio al abrir el enlace
            </p>
          )}
          {item.billingNote ? (
            <p className="text-sm text-muted-foreground">{item.billingNote}</p>
          ) : null}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">
          {item.description}
        </p>

      </CardHeader>

      <CardContent className="relative z-10 mt-auto flex flex-col gap-3 border-t bg-muted/30 px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto w-full flex cursor-default flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={handleCopy}
            disabled={Copied}
          >
            {Copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar enlace para compartir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
