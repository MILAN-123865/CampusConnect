import { useMemo } from "react";
import { Database } from "../types/database.types";

export type ClubRole = Database["public"]["Enums"]["club_role"] | "ADMIN" | "MODERATOR" | "EDITOR" | "VIEWER";

const hierarchy: Record<ClubRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  MODERATOR: 3,
  ADMIN: 4,
};

export function usePermissions(role?: ClubRole | string | null) {
  return useMemo(() => {
    // Normalize role and fallback to 0 if not provided or invalid
    const normalizedRole = role ? (role.toUpperCase() as ClubRole) : undefined;
    const level = normalizedRole && hierarchy[normalizedRole] ? hierarchy[normalizedRole] : 0;

    return {
      role: normalizedRole,
      canView: level >= hierarchy.VIEWER,
      canEdit: level >= hierarchy.EDITOR,
      canModerate: level >= hierarchy.MODERATOR,
      canDelete: normalizedRole === "ADMIN",
      canViewFinancials: normalizedRole === "ADMIN",
      canManageMembers: normalizedRole === "ADMIN",
      canManageRoles: normalizedRole === "ADMIN",
    };
  }, [role]);
}
