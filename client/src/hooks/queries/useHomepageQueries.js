import { useQuery } from "@tanstack/react-query"
import { fetchHomepageModules, fetchRecommendations, homepageKeys } from "@/api/music/homepage"

export const useHomepageModulesQuery = (options = {}) => {
  return useQuery({
    queryKey: homepageKeys.modules(),
    queryFn: fetchHomepageModules,
    staleTime: 1000 * 60 * 10,
    ...options,
  })
}

export const useRecommendationsQuery = (options = {}) => {
  return useQuery({
    queryKey: homepageKeys.recommendations(),
    queryFn: fetchRecommendations,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}
