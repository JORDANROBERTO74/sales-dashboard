"use client";

import { useMemo } from "react";
import { useUser } from "@/hooks/auth/use-user";

type UserScope = {
  isLoading: boolean;
  role: string | null;
  profileId: string | null;
  isAdminLike: boolean;
  isSeller: boolean;
  sellerId: string | null;
  canRunScopedQueries: boolean;
};

export function useUserScope(): UserScope {
  const userQuery = useUser();
  const user = userQuery.data;

  return useMemo(() => {
    const role = user?.role ?? null;
    const profileId = user?.id ?? null;
    const isAdminLike = role === "owner" || role === "admin";
    const isSeller = role === "seller";
    const sellerId = isSeller ? profileId : null;
    const canRunScopedQueries =
      !userQuery.isLoading && Boolean(user) && (!isSeller || Boolean(sellerId));

    return {
      isLoading: userQuery.isLoading,
      role,
      profileId,
      isAdminLike,
      isSeller,
      sellerId,
      canRunScopedQueries,
    };
  }, [user, userQuery.isLoading]);
}
