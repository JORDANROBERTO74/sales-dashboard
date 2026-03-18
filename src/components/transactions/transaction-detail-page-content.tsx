import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDetail } from "@/components/transactions/transaction-detail";

type TransactionDetailPageContentProps = {
  transactionId: string;
  backHref: string;
  title?: string;
  description?: string;
};

export function TransactionDetailPageContent({
  transactionId,
  backHref,
  title = "Detalle de transacción",
  description = "Revisa el estado, montos y asignación de esta transacción de Stripe.",
}: TransactionDetailPageContentProps) {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href={backHref} aria-label="Volver a transacciones">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <TransactionDetail transactionId={transactionId} />
    </div>
  );
}
