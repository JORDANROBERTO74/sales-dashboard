"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useMemberDetail,
  useTeamRoles,
  useUpdateMember,
} from "@/hooks/settings/use-team-management";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";

const detailSchema = z.object({
  roleId: z.string().min(1, "Selecciona un rol"),
  isActive: z.boolean(),
  commissionRate: z
    .string()
    .min(1, "La comisión es requerida")
    .refine(
      (value) => !Number.isNaN(Number(value)),
      "La comisión debe ser numérica",
    )
    .refine((value) => Number(value) >= 0, "La comisión no puede ser negativa")
    .refine(
      (value) => Number(value) <= 100,
      "La comisión no puede superar 100%",
    ),
});

type DetailValues = z.infer<typeof detailSchema>;

export function MemberDetail({ memberId }: { memberId: string }) {
  const memberQuery = useMemberDetail(memberId);
  const rolesQuery = useTeamRoles();
  const updateMember = useUpdateMember();

  const form = useForm<DetailValues>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      roleId: "",
      isActive: false,
      commissionRate: "0",
    },
  });

  useEffect(() => {
    if (!memberQuery.data || !rolesQuery.data) return;
    form.reset({
      roleId: memberQuery.data.role_id,
      isActive: memberQuery.data.is_active,
      commissionRate: String(memberQuery.data.commission_rate),
    });
  }, [memberQuery.data, rolesQuery.data, form]);

  const onSubmit = (values: DetailValues) => {
    if (!memberQuery.data) return;
    const current = memberQuery.data;
    const nextCommissionRate = Number(values.commissionRate);
    const payload: {
      userId: string;
      roleId?: string;
      isActive?: boolean;
      commissionRate?: number;
    } = { userId: current.id };

    if (values.roleId !== current.role_id) {
      payload.roleId = values.roleId;
    }
    if (values.isActive !== current.is_active) {
      payload.isActive = values.isActive;
    }
    if (nextCommissionRate !== current.commission_rate) {
      payload.commissionRate = nextCommissionRate;
    }

    if (
      payload.roleId === undefined &&
      payload.isActive === undefined &&
      payload.commissionRate === undefined
    ) {
      toast.info("No hay cambios para guardar");
      return;
    }

    updateMember.mutate(payload);
  };

  if (memberQuery.isLoading) {
    return <SettingsSectionSkeleton rows={2} showActions showHeader={false} />;
  }

  if (memberQuery.isError) {
    return (
      <SettingsErrorState
        message={getSettingsErrorMessage(memberQuery.error)}
        onRetry={() => {
          void memberQuery.refetch();
        }}
      />
    );
  }

  if (!memberQuery.data) {
    return (
      <p className="text-sm text-destructive">No se encontró el miembro.</p>
    );
  }

  const member = memberQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{member.full_name || "Sin nombre"}</CardTitle>
          <CardDescription>{member.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant={member.is_active ? "success" : "outline"}>
            {member.is_active ? "Activo" : "Inactivo"}
          </Badge>
          <Badge
            variant={member.onboarding_completed ? "secondary" : "outline"}
          >
            {member.onboarding_completed
              ? "Onboarding completo"
              : "Onboarding pendiente"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar miembro</CardTitle>
          <CardDescription>
            Ajusta rol, estado activo e índice de comisión operacional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="roleId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label>Rol</Label>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="member-role"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Selecciona rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {(rolesQuery.data ?? []).map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.display_name || role.role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="commissionRate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="commission-rate">Comisión (%)</Label>
                  <Input
                    id="commission-rate"
                    type="number"
                    inputMode="decimal"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Estado activo</p>
                    <p className="text-xs text-muted-foreground">
                      Si se desactiva, el usuario pierde acceso operativo.
                    </p>
                  </div>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Cambiar estado activo"
                  />
                </div>
              )}
            />

            <Button
              type="submit"
              disabled={updateMember.isPending}
              className="w-full sm:w-auto"
            >
              {updateMember.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Guardando...
                </span>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
