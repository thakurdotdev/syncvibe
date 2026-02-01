import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPaymentOrder, paymentKeys } from "@/api/payment"

export const useCreatePaymentOrderMutation = (options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPaymentOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.entitlement() })
    },
    ...options,
  })
}
