"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsErrorMessage } from "@/lib/settings/errors";
import { useMemo } from "react";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  onboarding_completed: boolean;
  commission_rate: number;
  role_id: string;
  role_name: string | null;
  role_display_name: string | null;
};

export type TeamRole = {
  id: string;
  role_name: string;
  display_name: string;
  hierarchy_level: number;
};

export type TeamInvitation = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  role_name: string | null;
  role_display_name: string | null;
};

type InvitePayload = {
  email: string;
  roleId: string;
};

export type TeamFilters = {
  roleId?: string;
  status?: "all" | "active" | "inactive";
  search?: string;
};

type MemberDetail = TeamMember & {
  phone: string | null;
  avatar_url: string | null;
};

type JsonResponse<T> = T & { error?: string; error_code?: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as JsonResponse<T>;
  if (!response.ok) {
    if (data.error_code) {
      throw new Error(`${data.error_code}::${data.error || "Error de servidor"}`);
    }
    throw new Error(data.error || "Error de servidor");
  }
  return data;
}

async function fetchTeamMembers(filters?: TeamFilters): Promise<TeamMember[]> {
  const params = new URLSearchParams();
  if (filters?.roleId) params.set("roleId", filters.roleId);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.search) params.set("q", filters.search);

  const query = params.toString();
  const url = query ? `/api/settings/team/members?${query}` : "/api/settings/team/members";
  const data = await requestJson<{ members: TeamMember[] }>(url);
  return data.members ?? [];
}

async function fetchRoles(): Promise<TeamRole[]> {
  const data = await requestJson<{ roles: TeamRole[] }>("/api/settings/team/roles");
  return data.roles ?? [];
}

async function fetchInvitations(): Promise<TeamInvitation[]> {
  const data = await requestJson<{ invitations: TeamInvitation[] }>(
    "/api/settings/team/invitations"
  );
  return data.invitations ?? [];
}

async function fetchMemberDetail(memberId: string): Promise<MemberDetail> {
  const data = await requestJson<{ member: MemberDetail }>(
    `/api/settings/team/members/${memberId}`
  );
  return data.member;
}

async function inviteMember(payload: InvitePayload) {
  return requestJson<{ ok: boolean; warning?: string }>("/api/settings/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function patchMember(
  userId: string,
  payload: { roleId?: string; isActive?: boolean; commissionRate?: number }
) {
  return requestJson<{ ok: boolean }>(`/api/settings/team/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function revokeInvitation(payload: { invitationId: string }) {
  return requestJson<{ ok: boolean }>(
    `/api/settings/team/invitations/${payload.invitationId}/revoke`,
    {
      method: "POST",
    }
  );
}

export function useTeamRoles() {
  return useQuery({
    queryKey: ["settings", "team-roles"],
    queryFn: fetchRoles,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useTeamList(filters?: TeamFilters) {
  return useQuery({
    queryKey: ["settings", "team-members", filters ?? {}],
    queryFn: () => fetchTeamMembers(filters),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTeamInvitations() {
  return useQuery({
    queryKey: ["settings", "team-invitations"],
    queryFn: fetchInvitations,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMemberDetail(memberId: string) {
  return useQuery({
    queryKey: ["settings", "team-member", memberId],
    queryFn: () => fetchMemberDetail(memberId),
    enabled: Boolean(memberId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function useRefreshTeamQueries() {
  const queryClient = useQueryClient();
  return useMemo(
    () => async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "team-members"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "team-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "team-member"] }),
      ]);
    },
    [queryClient]
  );
}

export function useInviteMember() {
  const refreshTeam = useRefreshTeamQueries();
  const mutation = useMutation({
    mutationFn: inviteMember,
    onSuccess: async (result) => {
      toast.success("Invitación creada", {
        description:
          result.warning ??
          "La invitación quedó registrada correctamente y se intentó enviar el correo.",
      });
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo invitar al miembro", {
        description: getSettingsErrorMessage(error),
      });
    },
  });

  return mutation;
}

export function useUpdateMemberRole() {
  const refreshTeam = useRefreshTeamQueries();
  return useMutation({
    mutationFn: (payload: { userId: string; roleId: string }) =>
      patchMember(payload.userId, { roleId: payload.roleId }),
    onSuccess: async () => {
      toast.success("Rol actualizado");
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el rol", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUpdateMemberStatus() {
  const refreshTeam = useRefreshTeamQueries();
  return useMutation({
    mutationFn: (payload: { userId: string; isActive: boolean }) =>
      patchMember(payload.userId, { isActive: payload.isActive }),
    onSuccess: async () => {
      toast.success("Estado actualizado");
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el estado", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUpdateMemberCommission() {
  const refreshTeam = useRefreshTeamQueries();
  return useMutation({
    mutationFn: (payload: { userId: string; commissionRate: number }) =>
      patchMember(payload.userId, { commissionRate: payload.commissionRate }),
    onSuccess: async () => {
      toast.success("Comisión actualizada");
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo actualizar la comisión", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useUpdateMember() {
  const refreshTeam = useRefreshTeamQueries();
  return useMutation({
    mutationFn: (payload: {
      userId: string;
      roleId?: string;
      isActive?: boolean;
      commissionRate?: number;
    }) =>
      patchMember(payload.userId, {
        roleId: payload.roleId,
        isActive: payload.isActive,
        commissionRate: payload.commissionRate,
      }),
    onSuccess: async () => {
      toast.success("Miembro actualizado");
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el miembro", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useRevokeInvitation() {
  const refreshTeam = useRefreshTeamQueries();
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: async () => {
      toast.success("Invitación revocada");
      await refreshTeam();
    },
    onError: (error) => {
      toast.error("No se pudo revocar la invitación", {
        description: getSettingsErrorMessage(error),
      });
    },
  });
}

export function useTeamManagement() {
  const membersQuery = useTeamList();
  const rolesQuery = useTeamRoles();
  const invitationsQuery = useTeamInvitations();
  const inviteMutation = useInviteMember();
  const updateRoleMutation = useUpdateMemberRole();
  const updateStatusMutation = useUpdateMemberStatus();
  const revokeMutation = useRevokeInvitation();

  return {
    membersQuery,
    rolesQuery,
    invitationsQuery,
    inviteMember: inviteMutation.mutate,
    updateMemberRole: updateRoleMutation.mutate,
    updateMemberStatus: updateStatusMutation.mutate,
    revokeInvitation: revokeMutation.mutate,
    isMutating:
      inviteMutation.isPending ||
      updateRoleMutation.isPending ||
      updateStatusMutation.isPending ||
      revokeMutation.isPending,
  };
}
