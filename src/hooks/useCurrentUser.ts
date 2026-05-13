import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: api.me,
    staleTime: Infinity,
  });
}
