import { useQuery } from "@tanstack/react-query"
import { fetchEntitlement, fetchPaymentHistory, fetchPlans, paymentKeys } from "@/api/payment"

export const useEntitlementQuery = (options = {}) => {
  return useQuery({
    queryKey: paymentKeys.entitlement(),
    queryFn: fetchEntitlement,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: false,
    ...options,
  })
}

export const usePlansQuery = (options = {}) => {
  return useQuery({
    queryKey: paymentKeys.plans(),
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    ...options,
  })
}

export const usePaymentHistoryQuery = (options = {}) => {
  return useQuery({
    queryKey: paymentKeys.history(),
    queryFn: fetchPaymentHistory,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    ...options,
  })
}
