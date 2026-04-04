export function getSettingsErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Ocurrió un error inesperado";

  const [errorCode, rawMessage] = message.includes("::")
    ? (message.split("::", 2) as [string, string])
    : [null, message];
  const lower = rawMessage.toLowerCase();

  if (errorCode) {
    const codeMap: Record<string, string> = {
      INVALID_INVITE_PAYLOAD: "Los datos de la invitación son inválidos.",
      INVITATION_RATE_LIMIT_EXCEEDED: "Límite de invitaciones excedido: máximo 20 por hora.",
      OWNER_ROLE_INVITE_FORBIDDEN: "Solo un owner puede invitar usuarios con rol owner.",
      LAST_OWNER_REINVITE_BLOCKED:
        "No se puede re-invitar al último owner activo hasta asignar otro owner.",
      AUTH_USER_DELETE_FAILED:
        "No se pudo limpiar el usuario previo en Auth para completar la re-invitación.",
      INVALID_MEMBER_PATCH_PAYLOAD: "Los datos enviados para actualizar miembro son inválidos.",
      NO_MEMBER_CHANGES: "No hay cambios para actualizar en el miembro.",
      INVALID_PAYMENT_METHOD_PAYLOAD: "Los datos del método de pago son inválidos.",
      INVALID_PAYMENT_METHOD_PATCH_PAYLOAD:
        "Los datos enviados para actualizar el método de pago son inválidos.",
      INVALID_QR_MIME: "Formato inválido. Solo se permiten PNG, JPG y WEBP.",
      QR_FILE_TOO_LARGE: "El archivo excede el tamaño máximo permitido (2MB).",
      INVALID_QR_EXTENSION:
        "Extensión inválida. Solo se permiten .png, .jpg, .jpeg y .webp.",
      INVALID_PROFILE_PAYLOAD: "Los datos del perfil son inválidos.",
      NO_PROFILE_CHANGES: "No hay cambios para actualizar en tu perfil.",
      PROFILE_READ_BEFORE_UPDATE_FAILED:
        "No se pudo validar tu perfil actual antes de aplicar cambios.",
      ASSIGNMENT_LOCKED_LEGACY_TRANSACTION:
        "Esta transacción no admite cambios de asignación (anterior al corte por fecha de creación).",
      INVALID_TRANSACTION_STATUS_PAYLOAD:
        "El estado de transacción enviado no es válido (máximo 50 caracteres).",
    };
    if (codeMap[errorCode]) {
      return codeMap[errorCode];
    }
  }

  if (lower.includes("solo un owner puede invitar con el rol owner")) {
    return "Solo un owner puede invitar usuarios con rol owner.";
  }
  if (lower.includes("límite de invitaciones excedido")) {
    return "Límite de invitaciones excedido: máximo 20 por hora.";
  }
  if (lower.includes("transición de estado inválida")) {
    return "La transición de estado de la invitación no es válida.";
  }
  if (lower.includes("no se puede degradar o desactivar al último owner activo")) {
    return "No puedes desactivar ni degradar al último owner activo.";
  }
  if (lower.includes("solo el owner puede modificar permissions")) {
    return "Solo el owner puede cambiar permisos o jerarquía de roles del sistema.";
  }
  if (lower.includes("email se sincroniza desde auth")) {
    return "El email se actualiza desde Auth, no manualmente en el perfil.";
  }
  if (lower.includes("no se puede quitar el predeterminado manualmente")) {
    return "No puedes quitar el método predeterminado manualmente. Marca otro como default.";
  }
  if (lower.includes("no se puede eliminar el método de pago predeterminado")) {
    return "No puedes eliminar el método predeterminado hasta elegir otro.";
  }
  if (lower.includes("no se puede eliminar este método de pago")) {
    return "No puedes eliminar este método porque tiene retiros pendientes.";
  }
  if (lower.includes("one_method_per_user")) {
    return "Solo puedes tener un método por tipo (binance, airtm o bank_qr).";
  }

  return rawMessage;
}
