import { useQueryClient } from "@tanstack/react-query"
import { Check, Crown, Sparkles, Zap } from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { paymentKeys } from "@/api/payment"
import { ChatContext } from "@/Context/ChatContext"
import { Context } from "@/Context/Context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useCreatePaymentOrderMutation } from "@/hooks/mutations/usePaymentMutations"
import { useEntitlementQuery, usePlansQuery } from "@/hooks/queries/useEntitlementQuery"

const planFeatures = {
  FREE: [
    "Up to 2 members in group music",
    "Basic music streaming",
    "Create playlists",
    "View posts and stories",
  ],
  PRO: [
    "Up to 10 members in group music",
    "Real-time chat in groups",
    "Real-time music sync",
    "Priority support",
    "Exclusive badges",
  ],
}

const planMeta = {
  FREE: { price: 0, description: "Get started with basic features" },
  PRO: { price: 299, description: "Unlock the full SyncVibe experience", popular: true },
}

export default function PlansPage() {
  const { user } = useContext(Context)
  const { socket } = useContext(ChatContext)
  const queryClient = useQueryClient()
  const { data: entitlement, isLoading: entitlementLoading } = useEntitlementQuery()
  const { data: dbPlans, isLoading: plansLoading } = usePlansQuery()
  const createOrderMutation = useCreatePaymentOrderMutation()
  const [processingPlan, setProcessingPlan] = useState(null)

  const currentPlan = entitlement?.plan?.code || "FREE"
  const isLoading = entitlementLoading || plansLoading

  useEffect(() => {
    if (!socket) return

    const handlePaymentSuccess = (data) => {
      toast.success("Payment successful! PRO features activated.")
      queryClient.invalidateQueries({ queryKey: paymentKeys.entitlement() })
      setProcessingPlan(null)
    }

    const handlePaymentFailed = (data) => {
      toast.error(data.message || "Payment failed")
      setProcessingPlan(null)
    }

    socket.on("payment-success", handlePaymentSuccess)
    socket.on("payment-failed", handlePaymentFailed)

    return () => {
      socket.off("payment-success", handlePaymentSuccess)
      socket.off("payment-failed", handlePaymentFailed)
    }
  }, [socket, queryClient])

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleUpgrade = async (planCode) => {
    if (planCode === "FREE" || currentPlan === planCode) return

    setProcessingPlan(planCode)

    try {
      const loaded = await loadRazorpay()
      if (!loaded) {
        toast.error("Failed to load payment gateway")
        setProcessingPlan(null)
        return
      }

      const orderData = await createOrderMutation.mutateAsync()

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SyncVibe",
        description: orderData.resumed ? "Resuming your payment..." : "PRO Plan Subscription",
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#6366f1",
        },
        handler: () => {
          // Payment success handled via socket event
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null)
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.on("payment.failed", (response) => {
        toast.error(response.error?.description || "Payment failed")
        setProcessingPlan(null)
      })
      razorpay.open()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create order")
      setProcessingPlan(null)
    }
  }

  const plans = (dbPlans || []).map((plan) => ({
    ...plan,
    ...planMeta[plan.code],
    features: planFeatures[plan.code] || [],
  }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3 flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Unlock premium features and enhance your music experience with SyncVibe PRO
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.code
          const isProcessing = processingPlan === plan.code

          return (
            <Card
              key={plan.code}
              className={`relative transition-all duration-300 ${
                plan.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border"
              } ${isCurrentPlan ? "ring-2 ring-primary/50" : ""}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  <Crown className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  {plan.code === "PRO" && <Zap className="h-5 w-5 text-yellow-500" />}
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="text-center pb-4">
                <div className="mb-6">
                  <span className="text-4xl font-bold">₹{plan.price}</span>
                  {plan.price > 0 && <span className="text-muted-foreground">/year</span>}
                </div>

                <ul className="space-y-3 text-left">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "secondary"}
                  disabled={isCurrentPlan || isProcessing || isLoading}
                  onClick={() => handleUpgrade(plan.code)}
                >
                  {isProcessing
                    ? "Processing..."
                    : isCurrentPlan
                      ? "Current Plan"
                      : plan.code === "FREE"
                        ? "Free Forever"
                        : "Upgrade to PRO"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Payments are processed securely via Razorpay. Your subscription will be activated after
        payment confirmation.
      </p>
    </div>
  )
}
