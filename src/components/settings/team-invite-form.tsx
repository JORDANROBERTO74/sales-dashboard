"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useInviteMember, useTeamRoles } from "@/hooks/settings/use-team-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

const inviteSchema = z.object({
  email: z.string().email("Debes ingresar un email válido"),
  roleId: z.string().min(1, "Selecciona un rol"),
});

type InviteValues = z.infer<typeof inviteSchema>;

type TeamInviteFormProps = {
  onSaved?: () => void;
};

export function TeamInviteForm({ onSaved }: TeamInviteFormProps) {
  const rolesQuery = useTeamRoles();
  const inviteMutation = useInviteMember();

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      roleId: "",
    },
  });

  const onSubmit = (values: InviteValues) => {
    inviteMutation.mutate(values, {
      onSuccess: () => {
        form.reset();
        onSaved?.();
      },
    });
  };

  if (rolesQuery.isLoading) {
    return <SettingsSectionSkeleton rows={1} showActions />;
  }

  if (rolesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitar miembro</CardTitle>
          <CardDescription>
            Crea una invitacion pendiente y envia el correo de onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsErrorState
            message={getSettingsErrorMessage(rolesQuery.error)}
            onRetry={() => {
              void rolesQuery.refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar miembro</CardTitle>
        <CardDescription>
          Crea una invitación pendiente y envía el correo de onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-3">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="md:col-span-2" data-invalid={fieldState.invalid}>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="usuario@empresa.com"
                  {...field}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="roleId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label>Rol</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rolesQuery.data ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <div className="md:col-span-3">
            <Button
              type="submit"
              disabled={inviteMutation.isPending || rolesQuery.isLoading}
              className="w-full sm:w-auto"
            >
              {inviteMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Enviando...
                </span>
              ) : (
                "Enviar invitacion"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
