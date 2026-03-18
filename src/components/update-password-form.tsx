"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
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
import { useUpdatePassword } from "@/hooks/auth/use-update-password";
import { useProfileSettings } from "@/hooks/settings/use-profile-settings";
import { Spinner } from "@/components/ui/spinner";

// Password validation regex: minimum 8 characters, at least one uppercase, one lowercase and one number
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Update password validation schema
const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
      passwordRegex,
      "La contraseña debe contener al menos una mayúscula, una minúscula y un número",
    ),
});

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm({
  className,
  isSessionReady = true,
  sessionError = null,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  isSessionReady?: boolean;
  sessionError?: string | null;
}) {
  const router = useRouter();
  const profileQuery = useProfileSettings({
    enabled: isSessionReady && !sessionError,
  });
  const { refetch: refetchProfile } = profileQuery;
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { updatePassword, isPending, isSuccess, errorMessage } =
    useUpdatePassword({
      redirectTo: "", // Empty string to disable default redirect
      refresh: true,
    });

  const form = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  useEffect(() => {
    if (isSuccess && !isRedirecting) {
      setIsRedirecting(true);
      const resolvePostUpdateRedirect = async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const { data } = await refetchProfile();
            if (data?.onboarding_completed) {
              router.push("/admin/dashboard");
              return;
            }
            router.push("/admin/onboarding");
            return;
          } catch {
            if (attempt === 0) {
              // Reintento corto para evitar redirecciones erróneas por fallos transitorios.
              await new Promise((resolve) => setTimeout(resolve, 300));
              continue;
            }
          }
        }

        // Fallback neutral: evita forzar onboarding cuando no se pudo leer perfil.
        router.push("/admin/dashboard");
      };
      void resolvePostUpdateRedirect();
    }
  }, [isSuccess, isRedirecting, refetchProfile, router]);

  const onSubmit = (data: UpdatePasswordFormData) => {
    updatePassword({
      password: data.password,
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

      <Card className="border-none shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Configurar Contraseña
          </CardTitle>
          <CardDescription>
            Por favor ingresa tu nueva contraseña para activar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Nueva contraseña</Label>
                      <Input
                        {...field}
                        id="password"
                        type="password"
                        placeholder="••••••••"
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
              {sessionError && (
                <p className="text-sm text-red-500">{sessionError}</p>
              )}
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={
                  isPending || isRedirecting || !isSessionReady || !!sessionError
                }
              >
                {isPending || isRedirecting ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {isRedirecting ? "Redirigiendo..." : "Guardando..."}
                  </span>
                ) : !isSessionReady ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Validando enlace...
                  </span>
                ) : (
                  "Guardar y continuar"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="px-8 text-center text-sm text-muted-foreground">
        Al continuar, aceptas nuestros{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Términos de Servicio
        </a>{" "}
        y{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Política de Privacidad
        </a>
        .
      </p>
    </div>
  );
}
