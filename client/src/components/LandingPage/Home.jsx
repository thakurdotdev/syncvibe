import { useProfile } from "@/Context/Context";
import {
  ArrowDown,
  Download,
  Loader2,
  MessageCircle,
  Music2,
  Share2,
  Smartphone,
  Star,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../App.css";
import LazyImage from "../LazyImage";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FlipWords } from "../ui/flip-words";
import { VideoIcon } from "lucide-react";
import Iphone15Pro from "../magicui/iphone-15-pro";
import Android from "../magicui/android";

const FeatureCard = lazy(() => import("./FeatureCard"));
const FAQ = lazy(() => import("./FAQ"));
const Newsletter = lazy(() => import("./Newsletter"));

const Home = () => {
  window.scrollTo(0, 0);
  const { user, loading } = useProfile();
  const navigate = useNavigate();
  const words = ["Vibe", "Moments", "Music", "Life"];
  const [showAppBanner, setShowAppBanner] = useState(true);

  useEffect(() => {
    if (user?.userid) {
      navigate("/feed");
    }
  }, [user?.userid]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Fixed height placeholder to account for fixed header */}
      <div className="h-16"></div>

      {showAppBanner && <AppBanner onClose={() => setShowAppBanner(false)} />}

      <main className="relative">
        <Hero words={words} />
        <MobileApp />
        <Features />
        <Experience />
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto" />
            </div>
          }
        >
          <FAQ />
          <Newsletter />
        </Suspense>
      </main>
    </div>
  );
};

const AppBanner = ({ onClose }) => (
  <div className="sticky top-16 z-50 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 py-3 px-4 text-white flex items-center justify-center  shadow-lg">
    <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
    <div className="flex items-center justify-center gap-2 z-10">
      <Smartphone className="w-4 h-4" />
      <p className="text-sm font-medium">
        SyncVibe is now available for Android!{" "}
        <a
          href="#download"
          className="underline font-bold hover:text-white/90 transition-colors hidden sm:inline-block"
        >
          Download the APK
        </a>
      </p>
    </div>
    <button
      onClick={onClose}
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white transition-colors"
      aria-label="Close banner"
    >
      &times;
    </button>
  </div>
);

const Hero = ({ words }) => (
  <section className="min-h-screen flex flex-col items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    {/* Abstract background elements */}
    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-purple-600/30 filter blur-[100px] animate-pulse"></div>
    <div
      className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-pink-600/20 filter blur-[120px] animate-pulse"
      style={{ animationDelay: "2s" }}
    ></div>
    <div
      className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-blue-600/20 filter blur-[80px] animate-pulse"
      style={{ animationDelay: "1s" }}
    ></div>

    <div className="z-10 text-center space-y-10 max-w-5xl flex items-center flex-col mx-auto mt-[120px]">
      <div className="relative">
        <Badge
          variant="outline"
          className="bg-white/10 backdrop-blur-md text-white px-6 py-2 rounded-full border-white/20 shadow-lg"
        >
          <Star className="w-4 h-4 mr-2 text-yellow-400" />
          <span>
            Introducing{" "}
            <span className="text-gradient font-bold">SyncVibe</span>
          </span>
        </Badge>
      </div>

      <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200 leading-tight">
        Where You Can Sync
        <div className="mt-4">
          <FlipWords words={words} interval={2000} transitionDuration={1000} />
        </div>
      </h1>

      <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed">
        Connect, share, and experience music together. Create unforgettable
        moments with friends through synchronized listening and real-time
        interactions.
      </p>

      <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
        <Link to="/register">
          <Button
            size="lg"
            className="rounded-full px-10 py-7 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-all shadow-xl shadow-purple-600/20 hover:shadow-purple-600/30"
          >
            Start Syncing Now
          </Button>
        </Link>
        <a href="#download">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full px-10 py-7 text-lg border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all shadow-xl shadow-pink-600/10"
          >
            <Download className="mr-2 h-5 w-5" />
            Get the App
          </Button>
        </a>
      </div>

      <div className="absolute bottom-10 animate-bounce">
        <ArrowDown className="w-6 h-6 text-white/60" />
      </div>
    </div>
  </section>
);

const MobileApp = () => (
  <section id="download" className="py-32 relative overflow-hidden">
    {/* Background elements */}
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/50 to-purple-900/10"></div>
    <div className="absolute -bottom-1/2 right-0 w-full h-full bg-gradient-to-t from-green-600/10 to-transparent rounded-full transform rotate-12 filter blur-3xl"></div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="flex flex-col md:flex-row items-center gap-16">
        {/* Left column: App details */}
        <div className="md:w-1/2">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 text-green-400 text-sm font-medium mb-6">
            <Smartphone className="w-4 h-4 mr-2" />
            NEW RELEASE
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
            SyncVibe for{" "}
            <span className="bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
              Android
            </span>
          </h2>

          <p className="text-xl text-white/80 mb-10 leading-relaxed">
            Take your music experience on the go with our new Android app. Sync
            with friends, chat, and share moments from anywhere.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="bg-gradient-to-br from-purple-500/30 to-purple-500/10 p-3 rounded-xl border border-purple-500/30 shadow-lg shadow-purple-500/5">
                <Music2 className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Music Listening
                </h3>
                <p className="text-white/70">
                  Enjoy your favorite tracks with friends in perfect sync
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="bg-gradient-to-br from-pink-500/30 to-pink-500/10 p-3 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/5">
                <MessageCircle className="w-6 h-6 text-pink-300" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Native Notifications
                </h3>
                <p className="text-white/70">
                  Stay connected with real-time notifications from your friends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="bg-gradient-to-br from-blue-500/30 to-blue-500/10 p-3 rounded-xl border border-blue-500/30 shadow-lg shadow-blue-500/5">
                <VideoIcon className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Video Calls
                </h3>
                <p className="text-white/70">
                  Connect with friends through high-quality video calls
                </p>
              </div>
            </div>
          </div>

          <a
            href="https://cdn.thakur.dev/SyncVibe.apk"
            className="inline-block mt-12"
          >
            <Button className="rounded-full px-8 py-6 text-lg bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90 transition-all shadow-xl shadow-blue-500/20 group">
              <Download className="mr-2 h-5 w-5 group-hover:animate-bounce" />
              Download APK
            </Button>
          </a>
        </div>

        {/* Right column: Phone mockup */}
        <div className="md:w-1/2 relative mt-16 md:mt-0 w-full flex justify-center">
          {/* Phone frame */}
          <div className="relative">
            <Android
              className="size-full"
              src={
                "https://res.cloudinary.com/dr7lkelwl/image/upload/syncvibe_app_login_page.webp"
              }
            />
          </div>

          {/* Glow effects */}
          <div className="absolute -z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-full filter blur-3xl"></div>
        </div>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="py-32 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-purple-900/5 to-black/20"></div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center mb-24">
        <h2 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200 mb-6">
          Features you will love to
          <span className="bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text ml-2">
            sync
          </span>
        </h2>
        <p className="text-xl text-white/70 max-w-2xl mx-auto">
          Discover all the ways SyncVibe helps you connect with friends
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto" />
            </div>
          }
        >
          <FeatureCard
            icon={Music2}
            title="Synchronized Music"
            description="Listen to music in perfect harmony with friends, no matter where they are"
            className="bg-gradient-to-br from-purple-900/30 to-purple-900/5 border-purple-500/20 hover:border-purple-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-purple-500 to-purple-700 text-white"
          />
          <FeatureCard
            icon={Video}
            title="HD Video Calls"
            description="Experience high-quality video calls with friends and family"
            className="bg-gradient-to-br from-blue-900/30 to-blue-900/5 border-blue-500/20 hover:border-blue-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-blue-500 to-blue-700 text-white"
          />
          <FeatureCard
            icon={MessageCircle}
            title="Real-time Chat"
            description="Stay connected with instant messaging and reactions"
            className="bg-gradient-to-br from-green-900/30 to-green-900/5 border-green-500/20 hover:border-green-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-green-500 to-green-700 text-white"
          />
          <FeatureCard
            icon={Share2}
            title="Share Stories"
            description="Share your favorite moments and memories with friends"
            className="bg-gradient-to-br from-pink-900/30 to-pink-900/5 border-pink-500/20 hover:border-pink-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-pink-500 to-pink-700 text-white"
          />
          <FeatureCard
            icon={Zap}
            title="Express Yourself"
            description="Share your thoughts and feelings with emojis, stickers, and reactions"
            className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/5 border-yellow-500/20 hover:border-yellow-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-yellow-500 to-yellow-700 text-white"
          />
          <FeatureCard
            icon={Users}
            title="Private Playlists"
            description="Create private playlists and share them with friends"
            className="bg-gradient-to-br from-indigo-900/30 to-indigo-900/5 border-indigo-500/20 hover:border-indigo-500/40 backdrop-blur-sm"
            iconClassName="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white"
          />
        </Suspense>
      </div>
    </div>
  </section>
);

const Experience = () => (
  <section className="py-32 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-black to-purple-900/10"></div>

    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center mb-24">
        <div className="inline-flex items-center px-4 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
          SHOWCASE
        </div>
        <h2 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
          Experience the Magic
        </h2>
        <p className="text-xl text-white/70 max-w-2xl mx-auto">
          Take a look at how SyncVibe transforms your music experience
        </p>
      </div>

      <div className="flex flex-col gap-20">
        <ExperienceCard
          title="Listen to your favorite music without any interruptions"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
          altText="SyncVibe Music Player"
          gradientFrom="from-purple-500/10"
          gradientTo="to-pink-500/10"
        />
        <ExperienceCard
          title="Chat with your friends in real-time"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736373340/posts/emlwh68crc59nv3zfbmp.webp"
          altText="SyncVibe Chat Interface"
          gradientFrom="from-blue-500/10"
          gradientTo="to-indigo-500/10"
        />
        <ExperienceCard
          title="Share your favorite moments with friends"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736688325/posts/m7xvw3jfhhzma1xj0jwn.webp"
          altText="SyncVibe Feed Interface"
          gradientFrom="from-green-500/10"
          gradientTo="to-emerald-500/10"
        />
        <ExperienceCard
          title="Take SyncVibe anywhere with our mobile app"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
          altText="SyncVibe Mobile App"
          gradientFrom="from-orange-500/10"
          gradientTo="to-red-500/10"
        />
      </div>
    </div>
  </section>
);

const ExperienceCard = ({
  title,
  imageSrc,
  altText,
  gradientFrom,
  gradientTo,
}) => (
  <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-8 lg:p-12 border border-white/10 shadow-2xl transition-all hover:border-white/20 group">
    <div className="text-center max-w-5xl mx-auto">
      <h2 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-12 tracking-tight">
        {title}
      </h2>

      <div className="mb-4 relative rounded-2xl overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-b ${gradientFrom} ${gradientTo} opacity-70 group-hover:opacity-100 transition-opacity duration-500`}
        ></div>
        <LazyImage
          src={imageSrc}
          alt={altText}
          className="w-full relative z-10 shadow-2xl transition-all duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-20"></div>
      </div>
    </div>
  </div>
);

export default Home;
