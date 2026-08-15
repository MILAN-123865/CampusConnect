import React from "react";
import { ClubRole } from "../../hooks/usePermissions";

interface RequirePermissionProps {
  allowedRoles: ClubRole[];
  userRole?: ClubRole | string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({
  allowedRoles,
  userRole,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const normalizedUserRole = userRole ? (userRole.toUpperCase() as ClubRole) : null;

  if (!normalizedUserRole || !allowedRoles.includes(normalizedUserRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
