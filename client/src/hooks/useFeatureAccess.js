import { useEntitlementQuery } from "@/hooks/queries/useEntitlementQuery"

export const useFeatureAccess = () => {
  const { data, isLoading } = useEntitlementQuery()
  const plan = data?.plan
  const isPro = plan?.code === "PRO"

  return {
    isPro,
    isLoading,
    planCode: plan?.code || "FREE",
    maxGroupMembers: plan?.maxGroupMembers || 2,
    canChat: plan?.realtimeChatEnabled || false,
    canSync: plan?.realtimeSyncEnabled || false,
  }
}
