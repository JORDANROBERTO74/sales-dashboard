"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import Link from "next/link";
import { useForgotPassword } from "@/hooks/auth/use-forgot-password";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// Forgot password validation schema
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export interface ForgotPasswordFormProps extends React.ComponentPropsWithoutRef<"div"> {
  /**
   * Link to login page
   * @default "/auth/login"
   */
  loginLink?: string;
}

export function ForgotPasswordForm({
  className,
  loginLink = "/auth/login",
  ...props
}: ForgotPasswordFormProps) {
  const { sendPasswordReset, isPending, isSuccess, errorMessage } =
    useForgotPassword();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    sendPasswordReset({
      email: data.email,
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Building2 className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">J-Node Sales</h1>
      </div>

      {isSuccess ? (
        <Card className="border-none shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Revisa tu Email
            </CardTitle>
            <CardDescription>
              Instrucciones enviadas correctamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground bg-muted/50 p-4 rounded-lg border">
              Si te registraste con tu email y contraseña, recibirás un enlace
              para restablecer tu contraseña en breve.
            </p>
            <Button asChild variant="outline" className="w-full h-11">
              <Link href={loginLink}>Volver al inicio de sesión</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Recuperar Contraseña
            </CardTitle>
            <CardDescription>
              Ingresa tu email y te enviaremos un enlace para restablecer tu
              cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-6">
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="m@example.com"
                          className="h-11"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </div>
                    </Field>
                  )}
                />
                {errorMessage && (
                  <p className="text-sm text-red-500">{errorMessage}</p>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isPending}
                >
                  {isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar enlace de recuperación"
                  )}
                </Button>
              </div>
              <div className="mt-6 text-center text-sm">
                ¿Ya tienes una cuenta?{" "}
                <Link
                  href={loginLink}
                  className="underline underline-offset-4 font-medium hover:text-primary"
                >
                  Iniciar Sesión
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
