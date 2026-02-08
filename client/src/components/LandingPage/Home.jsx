import {
  ArrowRight,
  Download,
  Headphones,
  Loader2,
  MessageCircle,
  Music,
  Share2,
  Users,
  Video,
} from "lucide-react"
import { lazy, memo, Suspense } from "react"
import { Link } from "react-router-dom"
import "../../App.css"
import LazyImage from "../LazyImage"
import Android from "../magicui/android"
import { Button } from "../ui/button"

const FAQ = lazy(() => import("./FAQ"))

const Hero = memo(() => (
  <section className="min-h-[90vh] flex items-center px-6 pt-20 pb-10">
    <div className="max-w-7xl mx-auto w-full">
      {/* Centered content at top */}
      <div className="text-center mb-16">
        {/* Small tag */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-medium text-emerald-400">Now Live</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
          Listen to music together,
          <br />
          <span className="bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            anywhere in the world.
          </span>
        </h1>

        {/* Description */}
        <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          SyncVibe lets you and your friends listen to the same music at the exact same time. Chat,
          video call, and vibe together.
        </p>

        {/* CTA */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/register">
            <Button
              size="lg"
              className="h-14 px-8 rounded-2xl bg-white text-black hover:bg-white/90 font-semibold text-base"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <a href="#download">
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-base"
            >
              <Download className="mr-2 h-5 w-5" />
              Download App
            </Button>
          </a>
        </div>
      </div>

      {/* Large centered screenshot */}
      <div className="relative max-w-5xl mx-auto">
        {/* Background glows */}
        <div className="absolute -inset-10 bg-linear-to-r from-emerald-500/30 via-teal-500/20 to-cyan-500/30 rounded-[3rem] blur-[80px] opacity-50" />

        {/* Main image container */}
        <div className="relative">
          {/* Glowing border effect */}
          <div className="absolute -inset-px bg-linear-to-r from-emerald-500/50 via-teal-500/50 to-cyan-500/50 rounded-3xl opacity-50" />

          {/* Screenshot */}
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black/50">
            <LazyImage
              src="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
              alt="SyncVibe App Dashboard"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Stats bar below image */}
        <div className="flex justify-center gap-12 mt-10">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">10K+</div>
            <div className="text-sm text-white/40">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">50K+</div>
            <div className="text-sm text-white/40">Songs Synced</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">4.9★</div>
            <div className="text-sm text-white/40">User Rating</div>
          </div>
        </div>
      </div>
    </div>
  </section>
))

const Features = memo(() => (
  <section id="features" className="py-24 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          Why people love <span className="text-emerald-400">SyncVibe</span>
        </h2>
        <p className="text-white/50 max-w-xl mx-auto">
          Everything you need to enjoy music with friends, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard
          icon={Headphones}
          title="Synchronized Playback"
          description="Everyone hears the same beat at the exact same moment, no matter where they are in the world."
          gradient="from-emerald-500/20 to-teal-500/20"
        />
        <FeatureCard
          icon={Video}
          title="Video Calls"
          description="See your friends reactions in real-time with crystal clear HD video while you listen together."
          gradient="from-blue-500/20 to-cyan-500/20"
        />
        <FeatureCard
          icon={MessageCircle}
          title="Live Chat"
          description="React, send emojis, and chat with your group while the music plays in the background."
          gradient="from-teal-500/20 to-cyan-500/20"
        />
        <FeatureCard
          icon={Users}
          title="Group Sessions"
          description="Create private rooms for your squad or join public sessions with music lovers worldwide."
          gradient="from-sky-500/20 to-blue-500/20"
        />
        <FeatureCard
          icon={Music}
          title="Shared Playlists"
          description="Collaborate on playlists with friends. Vote on the next track and discover new music."
          gradient="from-indigo-500/20 to-blue-500/20"
        />
        <FeatureCard
          icon={Share2}
          title="Share Stories"
          description="Post moments, share what you are listening to, and keep up with your friends music taste."
          gradient="from-cyan-500/20 to-teal-500/20"
        />
      </div>
    </div>
  </section>
))

const FeatureCard = memo(({ icon: Icon, title, description, gradient }) => (
  <div className="group relative">
    <div
      className={`absolute inset-0 bg-linear-to-br ${gradient} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`}
    />
    <div className="relative h-full p-8 rounded-3xl bg-white/3 border border-white/8 backdrop-blur-xs hover:border-white/20 transition-all">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
        <Icon className="w-7 h-7 text-white/80" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-white/40 leading-relaxed">{description}</p>
    </div>
  </div>
))

const MobileApp = memo(() => (
  <section id="download" className="px-6 py-24">
    <div className="max-w-6xl mx-auto">
      <div className="relative rounded-3xl overflow-hidden border border-white/8">
        {/* Background */}
        <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-teal-500/5" />
        <div className="absolute inset-0 bg-white/2" />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center p-5">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                Android App
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Take it anywhere</h2>

            <p className="text-lg text-white/50 mb-8 max-w-md leading-relaxed">
              Download the SyncVibe Android app. Native notifications, background playback, and
              seamless sync.
            </p>

            <a href="https://cdn.thakur.dev/SyncVibe.apk">
              <Button
                size="lg"
                className="h-12 px-6 rounded-xl bg-white text-black hover:bg-white/90 font-semibold"
              >
                <Download className="mr-2 h-4 w-4" />
                Download APK
              </Button>
            </a>

            {/* Stats */}
            <div className="flex gap-8 mt-10 pt-10 border-t border-white/8">
              <div>
                <div className="text-2xl font-bold text-white">4.9★</div>
                <div className="text-xs text-white/40">Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">10K+</div>
                <div className="text-xs text-white/40">Downloads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">Free</div>
                <div className="text-xs text-white/40">Forever</div>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="hidden lg:flex">
            <Android src="https://res.cloudinary.com/dr7lkelwl/image/upload/syncvibe_app_login_page.webp" />
          </div>
        </div>
      </div>
    </div>
  </section>
))

const FinalCTA = memo(() => (
  <section className="py-24 px-6">
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
        Ready to start syncing with your friends?
      </h2>
      <p className="text-lg text-white/50 mb-8">Join the community. It's free.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/register">
          <Button
            size="lg"
            className="h-12 px-8 rounded-xl bg-white text-black hover:bg-white/90 font-semibold"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link to="/login">
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
          >
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  </section>
))

const Home = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <div className="h-16" />
      <main>
        <Hero />
        <Features />
        <MobileApp />
        <Suspense
          fallback={
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          }
        >
          <FAQ />
        </Suspense>
        <FinalCTA />
      </main>
    </div>
  )
}

export default Home
