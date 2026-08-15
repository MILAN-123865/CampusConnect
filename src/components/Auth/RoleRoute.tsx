import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { ClubRole } from "../../hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStatus } from "../../hooks/useAuthStatus";

interface RoleRouteProps {
  allowedRoles: ClubRole[];
  children: React.ReactNode;
}

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuthStatus();

  const { data: role, isLoading } = useQuery({
    queryKey: ["clubRole", slug, user?.id],
    queryFn: async () => {
      if (!user?.id || !slug) return null;
      
      const { data: club } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", slug)
        .single();
        
      if (!club) return null;

      const { data: membership } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", club.id)
        .eq("user_id", user.id)
        .single();

      return membership?.role as ClubRole | null;
    },
    enabled: !!user?.id && !!slug,
  });

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  const normalizedUserRole = role ? (role.toUpperCase() as ClubRole) : null;

  if (!normalizedUserRole || !allowedRoles.includes(normalizedUserRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
