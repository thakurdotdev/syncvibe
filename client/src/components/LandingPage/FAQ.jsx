import { memo } from "react"

const FAQ = memo(() => (
  <section className="py-24 px-6">
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-white/50 max-w-xl mx-auto">Everything you need to know about SyncVibe</p>
      </div>

      {/* FAQ Items */}
      <div className="space-y-4">
        <FAQItem
          question="How do I get started with SyncVibe?"
          answer="Create a free account using Google or email, invite your friends, and start listening together. It takes less than a minute to set up."
        />
        <FAQItem
          question="Is SyncVibe available on mobile?"
          answer="Yes! SyncVibe works on all devices. You can use the web app on mobile browsers or download our Android app for the best experience."
        />
        <FAQItem
          question="How does synchronized playback work?"
          answer="When you create a group session, everyone in the room hears the exact same audio at the exact same moment. Our technology compensates for network latency to keep everyone in perfect sync."
        />
        <FAQItem
          question="Can I create private playlists?"
          answer="Absolutely. Create personal playlists or collaborative ones where friends can add tracks. You control who can view and edit each playlist."
        />
      </div>
    </div>
  </section>
))

const FAQItem = memo(({ question, answer }) => (
  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors">
    <h3 className="text-lg font-medium text-white mb-2">{question}</h3>
    <p className="text-white/50 text-sm leading-relaxed">{answer}</p>
  </div>
))

export default FAQ
