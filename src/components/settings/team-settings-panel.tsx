"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useRevokeInvitation,
  useTeamInvitations,
  useTeamList,
} from "@/hooks/settings/use-team-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { SettingsEmptyState } from "@/components/settings/states/settings-empty-state";
import { SettingsErrorState } from "@/components/settings/states/settings-error-state";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamInviteForm } from "@/components/settings/team-invite-form";

export function TeamSettingsPanel() {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [search]);

  const membersQuery = useTeamList({
    status: statusFilter,
    search: debouncedSearch || undefined,
  });
  const invitationsQuery = useTeamInvitations();
  const revokeMutation = useRevokeInvitation();

  const pendingInvitations = useMemo(
    () => (invitationsQuery.data ?? []).filter((item) => item.status === "pending"),
    [invitationsQuery.data]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Operaciones de equipo</CardTitle>
          <CardDescription>
            Administra miembros e invitaciones desde esta misma sección.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setIsInviteDialogOpen(true)}
          >
            Invitar miembro
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="#invitaciones-pendientes">Ver invitaciones pendientes</Link>
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={isInviteDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsInviteDialogOpen(nextOpen);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invitar miembro</DialogTitle>
            <DialogDescription>
              Crea una invitación pendiente y envía el acceso por correo.
            </DialogDescription>
          </DialogHeader>
          <TeamInviteForm onSaved={() => setIsInviteDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Miembros del equipo</CardTitle>
          <CardDescription>Administra rol y estado activo de los usuarios registrados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="space-y-2 w-full">
              <Label htmlFor="member-search">Buscar</Label>
              <Input
                id="member-search"
                placeholder="Email o nombre"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-col md:flex-row gap-2 w-full">
              <div className="space-y-2 w-full">
                <Label>Estado</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {membersQuery.isLoading ? (
            <SettingsSectionSkeleton rows={3} showHeader={false} />
          ) : membersQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(membersQuery.error)}
              onRetry={() => {
                void membersQuery.refetch();
              }}
            />
          ) : (membersQuery.data ?? []).length === 0 ? (
            <SettingsEmptyState
              title="No hay miembros para los filtros actuales."
              description="Ajusta la busqueda o cambia el filtro de estado."
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {(membersQuery.data ?? []).map((member) => (
                  <Card key={member.id}>
                    <CardContent className="space-y-4 p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{member.full_name || "Sin nombre"}</p>
                          <Badge variant="outline">
                            {member.role_display_name ?? member.role_name ?? "Sin rol"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground break-all">{member.email}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Estado</p>
                          <Badge variant={member.is_active ? "success" : "outline"} className="mt-1">
                            {member.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm text-muted-foreground">Comisión</span>
                        <span className="text-sm font-semibold">{member.commission_rate.toFixed(2)}%</span>
                      </div>
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/admin/settings/team/${member.id}`}>Ver detalle</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead className="text-right">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(membersQuery.data ?? []).map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{member.full_name || "Sin nombre"}</span>
                            <Badge variant="outline">
                              {member.role_display_name ?? member.role_name ?? "Sin rol"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant={member.is_active ? "success" : "outline"}>
                            {member.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>{member.commission_rate.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/settings/team/${member.id}`}>Ver</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card id="invitaciones-pendientes">
        <CardHeader>
          <CardTitle>Invitaciones pendientes</CardTitle>
          <CardDescription>
            Revoca invitaciones no utilizadas para mantener control operativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsQuery.isLoading ? (
            <SettingsSectionSkeleton rows={2} showHeader={false} />
          ) : invitationsQuery.isError ? (
            <SettingsErrorState
              message={getSettingsErrorMessage(invitationsQuery.error)}
              onRetry={() => {
                void invitationsQuery.refetch();
              }}
            />
          ) : pendingInvitations.length === 0 ? (
            <SettingsEmptyState
              title="No hay invitaciones pendientes."
              description="Cuando envies nuevas invitaciones apareceran aqui."
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {pendingInvitations.map((invitation) => (
                  <Card key={invitation.id}>
                    <CardContent className="space-y-3 p-4">
                      <p className="text-sm font-medium break-all">{invitation.email}</p>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-xs text-muted-foreground">Rol</span>
                        <span className="text-sm font-medium">{invitation.role_name ?? "-"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-xs text-muted-foreground">Expira</span>
                        <span className="text-sm font-medium">
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={revokingInvitationId === invitation.id}
                          >
                            {revokingInvitationId === invitation.id ? (
                              <span className="inline-flex items-center gap-2">
                                <Spinner />
                                Revocando...
                              </span>
                            ) : (
                              "Revocar invitacion"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción cambiará el estado de la invitación a revocada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                setRevokingInvitationId(invitation.id);
                                revokeMutation.mutate(
                                  { invitationId: invitation.id },
                                  {
                                    onSettled: () => setRevokingInvitationId(null),
                                  }
                                );
                              }}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>{invitation.role_name ?? "-"}</TableCell>
                        <TableCell>{new Date(invitation.expires_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={revokingInvitationId === invitation.id}
                              >
                                {revokingInvitationId === invitation.id ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Spinner />
                                    Revocando...
                                  </span>
                                ) : (
                                  "Revocar"
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción cambiará el estado de la invitación a revocada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setRevokingInvitationId(invitation.id);
                                    revokeMutation.mutate(
                                      { invitationId: invitation.id },
                                      {
                                        onSettled: () => setRevokingInvitationId(null),
                                      }
                                    );
                                  }}
                                >
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
