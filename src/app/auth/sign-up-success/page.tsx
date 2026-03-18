import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Building2 className="size-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">J-Node Sales</h1>
          </div>

          <Card className="border-none shadow-lg">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                <MailCheck className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">
                ¡Gracias por registrarte!
              </CardTitle>
              <CardDescription>
                Revisa tu email para confirmar tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-center text-muted-foreground bg-muted/50 p-4 rounded-lg border">
                Tu cuenta ha sido creada exitosamente. Revisa tu bandeja de
                entrada y haz clic en el enlace de confirmación para activar tu
                cuenta.
              </p>

              <Button asChild className="w-full h-11 text-base font-medium">
                <Link href="/auth/login">Ir al inicio de sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
