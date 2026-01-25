import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { fetchProfile, profileKeys } from "@/api/auth/profile"

export const useProfileQuery = (options = {}) => {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: fetchProfile,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: false,
    ...options,
  })
}

export const useProfileSuspenseQuery = (options = {}) => {
  return useSuspenseQuery({
    queryKey: profileKeys.current(),
    queryFn: fetchProfile,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    ...options,
  })
}
