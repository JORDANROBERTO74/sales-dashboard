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
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import Link from "next/link";
import { useSignUp } from "@/hooks/auth/use-sign-up";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { BRAND } from "@/config/brand";

// Password validation regex: minimum 8 characters, at least one uppercase, one lowercase and one number
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Sign up validation schema
const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "El email es requerido")
      .email("Ingresa un email válido"),
    password: z
      .string()
      .min(1, "La contraseña es requerida")
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        passwordRegex,
        "La contraseña debe contener al menos una mayúscula, una minúscula y un número",
      ),
    repeatPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "Las contraseñas no coinciden",
    path: ["repeatPassword"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signUp, isPending, errorMessage } = useSignUp({
    redirectTo: "/auth/sign-up-success",
    refresh: false,
  });

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      repeatPassword: "",
    },
  });

  const onSubmit = (data: SignUpFormData) => {
    signUp({
      email: data.email,
      password: data.password,
      repeatPassword: data.repeatPassword,
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Building2 className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{BRAND.appName}</h1>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Crear Cuenta</CardTitle>
          <CardDescription>
            Regístrate para comenzar a usar el dashboard.
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
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <PasswordInput
                        {...field}
                        id="password"
                        placeholder="••••••••"
                        className="h-11"
                        autoComplete="new-password"
                        showLabel="Mostrar contraseña principal"
                        hideLabel="Ocultar contraseña principal"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </div>
                  </Field>
                )}
              />
              <Controller
                name="repeatPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-2">
                      <Label htmlFor="repeat-password">
                        Repetir Contraseña
                      </Label>
                      <PasswordInput
                        {...field}
                        id="repeat-password"
                        placeholder="••••••••"
                        className="h-11"
                        autoComplete="new-password"
                        showLabel="Mostrar confirmación de contraseña"
                        hideLabel="Ocultar confirmación de contraseña"
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
                    Creando cuenta...
                  </span>
                ) : (
                  "Registrarse"
                )}
              </Button>
            </div>
            <div className="mt-6 text-center text-sm">
              ¿Ya tienes una cuenta?{" "}
              <Link
                href="/auth/login"
                className="underline underline-offset-4 font-medium hover:text-primary"
              >
                Iniciar Sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
