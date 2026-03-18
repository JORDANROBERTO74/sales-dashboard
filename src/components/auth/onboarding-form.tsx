"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "next-themes";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useProfileSettings,
  useUpdateProfileSettings,
} from "@/hooks/settings/use-profile-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

const onboardingSchema = z.object({
  fullName: z
    .string()
    .min(3, "El nombre es demasiado corto")
    .max(200, "Máximo 200 caracteres"),
  phone: z
    .string()
    .trim()
    .min(1, "El teléfono es obligatorio")
    .max(30, "Máximo 30 caracteres"),
  language: z.enum(["es", "en"]),
  theme: z.enum(["light", "dark"]),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

type OnboardingFormProps = React.ComponentPropsWithoutRef<"div">;

export function OnboardingForm({ className, ...props }: OnboardingFormProps) {
  const router = useRouter();
  const profileQuery = useProfileSettings();
  const updateProfile = useUpdateProfileSettings();
  const { setTheme } = useTheme();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      language: "es",
      theme: "light",
    },
  });
  const { reset } = form;

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        fullName: profileQuery.data.full_name ?? "",
        phone: profileQuery.data.phone ?? "",
        language: profileQuery.data.preferences?.language ?? "es",
        theme: profileQuery.data.preferences?.theme ?? "light",
      });

      if (profileQuery.data.onboarding_completed) {
        router.push("/admin/dashboard");
      }
    }
  }, [profileQuery.data, reset, router]);

  const onSubmit = (values: OnboardingFormValues) => {
    updateProfile.mutate(
      {
        fullName: values.fullName,
        phone: values.phone,
        onboardingCompleted: true,
        preferences: {
          language: values.language,
          theme: values.theme,
        },
      },
      {
        onSuccess: () => {
          router.push("/admin/dashboard");
        },
      },
    );
  };

  if (profileQuery.isLoading) {
    return (
      <Card className="border-none shadow-lg">
        <CardHeader className="space-y-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-11 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (profileQuery.isError) {
    return (
      <SettingsErrorState
        message={getSettingsErrorMessage(profileQuery.error)}
        onRetry={() => {
          void profileQuery.refetch();
        }}
      />
    );
  }

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
            Bienvenido al proyecto
          </CardTitle>
          <CardDescription>
            Completa tu perfil para comenzar a utilizar el dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4">
              <Controller
                name="fullName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Label htmlFor="full-name">Nombre completo</Label>
                    <Input
                      id="full-name"
                      placeholder="Tu nombre y apellido"
                      autoComplete="name"
                      {...field}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+59171234567"
                      autoComplete="tel"
                      required
                      {...field}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="language"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <Label>Idioma</Label>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  name="theme"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <Label>Tema</Label>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          setTheme(val);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tema" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Oscuro</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="w-full h-11 text-base font-medium"
            >
              {updateProfile.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Guardando...
                </span>
              ) : (
                "Completar registro"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Skeleton for Card
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
