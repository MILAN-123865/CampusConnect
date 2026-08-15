import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStatus } from "./useAuthStatus";
import { ClubRole } from "./usePermissions";

export function useClubRole(clubId?: string) {
  const { user } = useAuthStatus();

  return useQuery({
    queryKey: ["clubRole", clubId, user?.id],
    queryFn: async () => {
      if (!user?.id || !clubId) return null;

      const { data: membership } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();

      return (membership?.role as ClubRole) || null;
    },
    enabled: !!user?.id && !!clubId,
  });
}
