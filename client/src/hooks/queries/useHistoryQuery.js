import { useQuery } from "@tanstack/react-query"
import { fetchHistory, historyKeys } from "@/api/music/history"

export const useHistoryQuery = ({ page, limit, sortBy, sortOrder, searchQuery }) => {
  return useQuery({
    queryKey: historyKeys.list({ page, limit, sortBy, sortOrder, searchQuery }),
    queryFn: () => fetchHistory({ page, limit, sortBy, sortOrder, searchQuery }),
    staleTime: 1000 * 60 * 5,
  })
}
