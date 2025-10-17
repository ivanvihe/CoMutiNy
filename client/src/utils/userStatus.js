export const resolveUserStatus = (user) => {
  if (!user) {
    return {
      code: 'unknown',
      label: 'Desconocido',
      chipColor: 'default',
      tooltip: 'No se pudo determinar el estado del usuario'
    };
  }

  if (user.isBanned) {
    return {
      code: 'banned',
      label: 'Baneado',
      chipColor: 'error',
      tooltip: user.moderationReason || 'El usuario fue baneado permanentemente'
    };
  }

  const suspensionUntil = user.suspensionUntil ? new Date(user.suspensionUntil) : null;

  if (suspensionUntil && suspensionUntil.getTime() > Date.now()) {
    const formatted = suspensionUntil.toLocaleString();

    return {
      code: 'suspended',
      label: 'Suspendido',
      chipColor: 'warning',
      tooltip: user.moderationReason
        ? `${user.moderationReason} (hasta ${formatted})`
        : `Suspendido hasta ${formatted}`,
      until: suspensionUntil
    };
  }

  return {
    code: 'active',
    label: 'Activo',
    chipColor: 'success',
    tooltip: 'El usuario puede acceder normalmente'
  };
};
