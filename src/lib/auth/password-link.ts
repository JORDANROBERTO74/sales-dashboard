"use client";

import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

export type PasswordLinkType = "invite" | "recovery";

type ParsedAuthFragment = {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  hasAuthTokensInHash: boolean;
};

function parseAuthFragment(hash: string): ParsedAuthFragment {
  if (!hash || !hash.startsWith("#")) {
    return {
      accessToken: null,
      refreshToken: null,
      type: null,
      hasAuthTokensInHash: false,
    };
  }

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  return {
    accessToken,
    refreshToken,
    type,
    hasAuthTokensInHash: params.has("access_token") || params.has("refresh_token"),
  };
}

export function detectPasswordLinkTypeFromLocation(
  location: Pick<Location, "hash" | "search">,
): PasswordLinkType | null {
  const hashData = parseAuthFragment(location.hash);
  if (hashData.type === "invite" || hashData.type === "recovery") {
    return hashData.type;
  }

  const searchParams = new URLSearchParams(location.search);
  const queryType = searchParams.get("type");
  if (queryType === "invite" || queryType === "recovery") {
    return queryType;
  }

  return null;
}

function clearUrlHash() {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

function clearUrlSearchParams() {
  window.history.replaceState(null, "", window.location.pathname);
}

function getPkceCodeVerifier(): string | null {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    if (!projectRef) return null;
    const key = `sb-${projectRef}-auth-token-code-verifier`;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

type InitPasswordLinkSessionOptions = {
  supabase: SupabaseClient;
  expectedType: PasswordLinkType;
};

export async function initPasswordLinkSession({
  supabase,
  expectedType,
}: InitPasswordLinkSessionOptions): Promise<string | null> {
  const hashData = parseAuthFragment(window.location.hash);
  const searchParams = new URLSearchParams(window.location.search);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const queryType = searchParams.get("type");

  if (hashData.hasAuthTokensInHash) {
    if (!hashData.accessToken || !hashData.refreshToken) {
      clearUrlHash();
      return "El enlace de acceso está incompleto. Solicita uno nuevo.";
    }

    if (hashData.type && hashData.type !== expectedType) {
      clearUrlHash();
      return "Este enlace no corresponde a este flujo.";
    }

    const { error } = await supabase.auth.setSession({
      access_token: hashData.accessToken,
      refresh_token: hashData.refreshToken,
    });

    clearUrlHash();

    if (error) {
      return "El enlace no es válido o expiró. Solicita uno nuevo.";
    }
  } else if (tokenHash) {
    if (!queryType) {
      clearUrlSearchParams();
      return "El enlace está incompleto. Solicita uno nuevo.";
    }

    const otpType = queryType as EmailOtpType;
    if (otpType !== expectedType) {
      clearUrlSearchParams();
      return "Este enlace no corresponde a este flujo.";
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    clearUrlSearchParams();

    if (error) {
      return "El enlace no es válido o expiró. Solicita uno nuevo.";
    }
  } else if (token) {
    if (!queryType) {
      clearUrlSearchParams();
      return "El enlace está incompleto. Solicita uno nuevo.";
    }

    const otpType = queryType as EmailOtpType;
    if (otpType !== expectedType) {
      clearUrlSearchParams();
      return "Este enlace no corresponde a este flujo.";
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: otpType,
    });
    clearUrlSearchParams();

    if (error) {
      return "El enlace no es válido o expiró. Solicita uno nuevo.";
    }
  } else if (code) {
    if (queryType && queryType !== expectedType) {
      clearUrlSearchParams();
      return "Este enlace no corresponde a este flujo.";
    }

    const codeVerifier = getPkceCodeVerifier();
    if (!codeVerifier) {
      clearUrlSearchParams();
      return "El enlace no es válido o expiró. Solicita uno nuevo.";
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    clearUrlSearchParams();

    if (error) {
      return "El enlace no es válido o expiró. Solicita uno nuevo.";
    }
  } else {
    return "No se detectó un enlace válido para actualizar la contraseña.";
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return "No se encontró una sesión válida para actualizar la contraseña.";
  }

  return null;
}
