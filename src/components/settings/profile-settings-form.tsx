"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "next-themes";
import {
  useProfileSettings,
  useUpdateProfileEmail,
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
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

const profileSchema = z.object({
  fullName: z.string().max(200, "Máximo 200 caracteres").optional(),
  phone: z.string().max(30, "Máximo 30 caracteres").optional(),
  themeDark: z.boolean(),
  language: z.enum(["es", "en"]),
  notificationsEmail: z.boolean(),
  notificationsPush: z.boolean(),
});

const emailSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;

export function ProfileSettingsForm() {
  const profileQuery = useProfileSettings();
  const updateProfile = useUpdateProfileSettings();
  const updateEmail = useUpdateProfileEmail();
  const { setTheme } = useTheme();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      themeDark: false,
      language: "es",
      notificationsEmail: true,
      notificationsPush: false,
    },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const profileSyncKey = profileQuery.data
    ? `${profileQuery.data.id}:${profileQuery.data.updated_at ?? ""}`
    : "";

  useEffect(() => {
    if (!profileQuery.data) return;
    const preferences = profileQuery.data.preferences ?? {};
    const notifications = preferences.notifications ?? {};
    if (preferences.theme === "dark" || preferences.theme === "light") {
      setTheme(preferences.theme);
    }

    profileForm.reset({
      fullName: profileQuery.data.full_name ?? "",
      phone: profileQuery.data.phone ?? "",
      themeDark: preferences.theme === "dark",
      language: preferences.language ?? "es",
      notificationsEmail: notifications.email ?? true,
      notificationsPush: notifications.push ?? false,
    });
    emailForm.reset({
      email: profileQuery.data.email ?? "",
    });
  }, [profileSyncKey]);

  const onSubmitProfile = (values: ProfileFormValues) => {
    updateProfile.mutate({
      fullName: values.fullName ?? "",
      phone: values.phone ?? "",
      preferences: {
        theme: values.themeDark ? "dark" : "light",
        language: values.language,
        notifications: {
          email: values.notificationsEmail,
          push: values.notificationsPush,
        },
      },
    });
  };

  const onSubmitEmail = (values: EmailFormValues) => {
    updateEmail.mutate(values.email);
  };

  if (profileQuery.isLoading) {
    return <SettingsSectionSkeleton rows={2} showActions showHeader={false} />;
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

  if (!profileQuery.data) {
    return <SettingsErrorState message="No se pudo cargar tu perfil." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>
            Edita tu nombre, contacto, avatar y preferencias de experiencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit(onSubmitProfile)}
            className="space-y-5"
          >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Información personal
              </h3>
              <Controller
                name="fullName"
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Label htmlFor="profile-full-name">Nombre completo</Label>
                    <Input
                      id="profile-full-name"
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
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Label htmlFor="profile-phone">Teléfono</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      {...field}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Preferencias
              </h3>
              <Controller
                name="themeDark"
                control={profileForm.control}
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Tema oscuro</p>
                      <p className="text-xs text-muted-foreground">
                        Activa la apariencia oscura para tu panel.
                      </p>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setTheme(checked ? "dark" : "light");
                      }}
                      aria-label="Activar tema oscuro"
                    />
                  </div>
                )}
              />
              <Controller
                name="language"
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Label>Idioma</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="w-full sm:w-auto"
            >
              {updateProfile.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Guardando...
                </span>
              ) : (
                "Guardar perfil"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Correo de acceso</CardTitle>
          <CardDescription>
            El cambio de email se procesa vía Auth y requiere confirmación del
            nuevo correo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={emailForm.handleSubmit(onSubmitEmail)}
            className="space-y-4"
          >
            <Controller
              name="email"
              control={emailForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="profile-email">Nuevo email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Button
              type="submit"
              variant="outline"
              disabled={updateEmail.isPending}
              className="w-full sm:w-auto"
            >
              {updateEmail.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Enviando...
                </span>
              ) : (
                "Solicitar cambio de email"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
