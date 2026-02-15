const RefundPolicy = () => {
  document.title = "Refund Policy - SyncVibe"
  window.scrollTo(0, 0)

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-6 py-14 lg:px-8 shadow-lg rounded-lg">
        <header className="border-b pb-6 mb-6">
          <h1 className="text-3xl font-bold ">Refund & Cancellation Policy</h1>
          <p className="mt-2 text-gray-600">Last Updated: February 15, 2026</p>
        </header>

        <main className="space-y-6  leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold ">1. No Refunds</h2>
            <p className="mt-2">
              All purchases made on SyncVibe, including PRO plan subscriptions, are{" "}
              <strong>final and non-refundable</strong>. Once a payment has been successfully
              processed, no refunds will be issued under any circumstances.
            </p>
            <p className="mt-2">
              By completing a purchase, you acknowledge and agree that you have reviewed the
              features and benefits of the plan before making the payment, and you accept this
              no-refund policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">2. Cancellation of Subscription</h2>
            <p className="mt-2">
              SyncVibe PRO is a one-time purchase and does not auto-renew. There is no recurring
              subscription to cancel. Your PRO access remains active for the duration of the
              purchased plan period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">3. Duplicate Payments</h2>
            <p className="mt-2">
              If you are charged more than once for the same purchase due to a technical error,
              please contact us within 7 days of the transaction. We will investigate and process a
              refund for the duplicate charge only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">4. Failed Transactions</h2>
            <p className="mt-2">
              If a payment fails or is not completed, no charge will be applied to your account. If
              your account was debited but the transaction was not completed on our end, please
              contact us with your transaction details, and we will resolve the issue within 5-7
              business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">5. Payment Gateway</h2>
            <p className="mt-2">
              All payments are processed securely through Razorpay. SyncVibe does not store your
              payment card details. For any payment-related disputes, you may also contact
              Razorpay's support directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">6. Service Modifications</h2>
            <p className="mt-2">
              SyncVibe reserves the right to modify, suspend, or discontinue any features or
              services at any time. In such cases, no refunds will be issued for the remaining
              duration of any active plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold ">7. Contact Us</h2>
            <p className="mt-2">
              If you have any questions about this Refund & Cancellation Policy or need assistance
              with a payment issue, please contact us at{" "}
              <a href="mailto:info@thakur.dev" className="text-blue-600 hover:underline">
                info@thakur.dev
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

export default RefundPolicy
