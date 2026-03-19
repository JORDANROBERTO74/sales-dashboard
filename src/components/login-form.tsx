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
import { useSignIn } from "@/hooks/auth/use-sign-in";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// Login validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export interface LoginFormProps extends React.ComponentPropsWithoutRef<"div"> {
  /**
   * URL to redirect to after successful login
   * @default undefined (uses query param or hook default)
   */
  redirectTo?: string;
  /**
   * Title of the login form
   * @default "Iniciar Sesión"
   */
  title?: string;
  /**
   * Description text below the title
   * @default "Ingresa tu email a continuación para iniciar sesión en tu cuenta"
   */
  description?: string;
  /**
   * Link to forgot password page
   * @default "/auth/forgot-password"
   */
  forgotPasswordLink?: string;
  /**
   * Link to sign up page (if null, hides the sign up link)
   * @default "/auth/sign-up"
   */
  signUpLink?: string | null;
  /**
   * Text for the sign up link
   * @default "Regístrate"
   */
  signUpLinkText?: string;
}

export function LoginForm({
  className,
  redirectTo,
  title = "Bienvenido",
  description = "Ingresa tus credenciales para acceder a tu panel.",
  forgotPasswordLink = "/auth/forgot-password",
  ...props
}: LoginFormProps) {
  const { signIn, isPending, errorMessage } = useSignIn({
    redirectTo,
    refresh: true,
    useQueryRedirect: true,
  });

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    signIn({
      email: data.email,
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
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
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
                      <div className="flex items-center">
                        <Label htmlFor="password">Contraseña</Label>
                        <Link
                          href={forgotPasswordLink}
                          className="ml-auto inline-block text-sm font-medium underline-offset-4 hover:underline hover:text-primary"
                        >
                          ¿Olvidaste tu contraseña?
                        </Link>
                      </div>
                      <PasswordInput
                        {...field}
                        id="password"
                        placeholder="••••••••"
                        className="h-11"
                        autoComplete="current-password"
                        showLabel="Mostrar contraseña de acceso"
                        hideLabel="Ocultar contraseña de acceso"
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
                    Iniciando sesión...
                  </span>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
