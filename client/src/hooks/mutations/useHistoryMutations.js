import { useMutation } from "@tanstack/react-query"
import { addToHistory } from "@/api/music/history"

export const useAddToHistoryMutation = (options = {}) => {
  return useMutation({
    mutationFn: addToHistory,
    ...options,
  })
}
