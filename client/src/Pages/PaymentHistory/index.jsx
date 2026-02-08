import {
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Calendar,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { usePaymentHistoryQuery } from "@/hooks/queries/useEntitlementQuery"

const statusConfig = {
  PAID: { label: "Success", variant: "default", icon: CheckCircle, color: "text-green-500" },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle, color: "text-red-500" },
  CREATED: { label: "Pending", variant: "secondary", icon: Clock, color: "text-yellow-500" },
}

const formatAmount = (amountInPaise, currency = "INR") => {
  const amount = amountInPaise / 100
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amount)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function PaymentCard({ payment }) {
  const config = statusConfig[payment.status] || statusConfig.CREATED
  const StatusIcon = config.icon

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border/60">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-base">PRO Subscription</p>
                <Badge variant={config.variant} className="text-xs">
                  <StatusIcon className={`h-3 w-3 mr-1 ${config.color}`} />
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(payment.createdAt)}</span>
              </div>
              {payment.razorpayPaymentId && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  ID: {payment.razorpayPaymentId}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-lg">{formatAmount(payment.amount, payment.currency)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No payment history</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Your payment transactions will appear here once you make a purchase.
        </p>
      </CardContent>
    </Card>
  )
}

export default function PaymentHistoryPage() {
  const { data: payments, isLoading, isError } = usePaymentHistoryQuery()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card className="mb-6 bg-linear-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Payment History</CardTitle>
              <CardDescription>View all your payment transactions</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <PaymentSkeleton key={i} />)
        ) : isError ? (
          <Card className="border-destructive/50">
            <CardContent className="py-8 text-center">
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">Failed to load payment history</p>
            </CardContent>
          </Card>
        ) : !payments?.length ? (
          <EmptyState />
        ) : (
          payments.map((payment) => <PaymentCard key={payment.paymentid} payment={payment} />)
        )}
      </div>
    </div>
  )
}
