import { useProfile } from "@/Context/Context";
import {
  ArrowDown,
  ChevronsDown,
  Download,
  Loader2,
  MessageCircle,
  Smartphone,
  Music2,
  Share2,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../App.css";
import LazyImage from "../LazyImage";
import { Button } from "../ui/button";
import { FlipWords } from "../ui/flip-words";
import { HoverBorderGradient } from "../ui/hover-border-gradient";
import { Badge } from "../ui/badge";

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
      {showAppBanner && (
        <AppBanner onClose={() => setShowAppBanner(false)} />
      )}
      <main className="relative">
        <Hero words={words} />
        <MobileApp />
        <Features />
        <Experience />
        <Suspense
          fallback={
            <div className="h-screen flex items-center justify-center">
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
  <div className="bg-gradient-to-r from-purple-600 to-pink-600 py-3 px-4 text-white flex items-center justify-center relative">
    <Smartphone className="w-4 h-4 mr-2" />
    <p className="text-sm font-medium">
      SyncVibe is now available for Android! <a href="#download" className="underline font-bold">Download the APK</a>
    </p>
    <button 
      onClick={onClose} 
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white"
      aria-label="Close banner"
    >
      &times;
    </button>
  </div>
);

const Hero = ({ words }) => (
  <section className="min-h-screen flex flex-col items-center px-4 sm:px-6 lg:px-8 relative">
    <div className="z-10 text-center space-y-8 max-w-5xl flex items-center flex-col mx-auto mt-[150px]">
      <Badge variant="outline" className="bg-white/5 backdrop-blur-sm text-white px-4 py-2 rounded-full border-white/10">
        <span className="mr-1">🎉</span>
        <span>
          Introducing <span className="text-gradient font-bold">SyncVibe</span>
        </span>
      </Badge>

      <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 leading-tight">
        Where You Can Sync
        <div className="mt-2">
          <FlipWords words={words} interval={2000} transitionDuration={1000} />
        </div>
      </h1>

      <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
        Connect, share, and experience music together. Create unforgettable
        moments with friends through synchronized listening and real-time
        interactions.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
        <Link to="/register">
          <Button size="lg" className="rounded-full px-8 py-6 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-all">
            Start Syncing Now
          </Button>
        </Link>
        <a href="#download">
          <Button variant="outline" size="lg" className="rounded-full px-8 py-6 text-lg border-white/20 hover:bg-white/10 transition-all">
            <Download className="mr-2 h-5 w-5" />
            Get the App
          </Button>
        </a>
      </div>

      <div className="absolute bottom-10 animate-bounce">
        <ArrowDown className="w-6 h-6 text-white/60" />
      </div>
    </div>

    {/* Background gradient elements */}
    <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-600/20 rounded-full filter blur-3xl"></div>
    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full filter blur-3xl"></div>
  </section>
);

const MobileApp = () => (
  <section id="download" className="py-24 bg-gradient-to-b from-black to-purple-900/20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row items-center gap-12">
        <div className="md:w-1/2">
          <Badge className="mb-4 bg-purple-600/20 text-purple-300 border-purple-500/30">
            NEW
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            SyncVibe now on{" "}
            <span className="bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
              Android
            </span>
          </h2>
          <p className="text-xl text-white/70 mb-8 leading-relaxed">
            Take your music experience on the go with our new Android app. Sync with friends, chat, and share moments from anywhere.
          </p>
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <Music2 className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Offline Listening</h3>
                <p className="text-white/60">Download your favorite tracks for offline listening</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-pink-500/20 p-2 rounded-lg">
                <MessageCircle className="w-5 h-5 text-pink-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Native Notifications</h3>
                <p className="text-white/60">Never miss a message from your friends</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Share2 className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Easy Sharing</h3>
                <p className="text-white/60">Share music directly to other apps</p>
              </div>
            </div>
          </div>
          <Button className="mt-8 rounded-full px-8 py-6 text-lg bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90 transition-all">
            <Download className="mr-2 h-5 w-5" />
            Download APK
          </Button>
        </div>
        <div className="md:w-1/2 relative">
          <div className="relative z-10">
            <LazyImage
              src="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
              alt="SyncVibe Mobile App"
              className="rounded-3xl shadow-2xl border border-white/10"
            />
          </div>
          <div className="absolute -z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-to-r from-green-500/30 to-blue-500/30 rounded-full filter blur-3xl"></div>
        </div>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="py-32">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
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
            className="border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-transparent"
          />
          <FeatureCard
            icon={Video}
            title="HD Video Calls"
            description="Experience high-quality video calls with friends and family"
            className="border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-transparent"
          />
          <FeatureCard
            icon={MessageCircle}
            title="Real-time Chat"
            description="Stay connected with instant messaging and reactions"
            className="border-green-500/20 bg-gradient-to-br from-green-900/20 to-transparent"
          />
          <FeatureCard
            icon={Share2}
            title="Share Stories"
            description="Share your favorite moments and memories with friends"
            className="border-pink-500/20 bg-gradient-to-br from-pink-900/20 to-transparent"
          />
          <FeatureCard
            icon={Zap}
            title="Express Yourself"
            description="Share your thoughts and feelings with emojis, stickers, and reactions"
            className="border-yellow-500/20 bg-gradient-to-br from-yellow-900/20 to-transparent"
          />
          <FeatureCard
            icon={Users}
            title="Private Playlists"
            description="Create private playlists and share them with friends"
            className="border-indigo-500/20 bg-gradient-to-br from-indigo-900/20 to-transparent"
          />
        </Suspense>
      </div>
    </div>
  </section>
);

const Experience = () => (
  <section className="py-32 bg-gradient-to-b from-transparent to-purple-900/10">
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
          Experience the Magic
        </h2>
        <p className="text-xl text-white/70 max-w-2xl mx-auto">
          Take a look at how SyncVibe transforms your music experience
        </p>
      </div>
      <div className="flex flex-col gap-16">
        <ExperienceCard
          title="Listen to your favorite music without any interruptions"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
          altText="SyncVibe Music Player"
        />
        <ExperienceCard
          title="Chat with your friends in real-time"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736373340/posts/emlwh68crc59nv3zfbmp.webp"
          altText="SyncVibe Chat Interface"
        />
        <ExperienceCard
          title="Share your favorite moments with friends"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736688325/posts/m7xvw3jfhhzma1xj0jwn.webp"
          altText="SyncVibe Feed Interface"
        />
        <ExperienceCard
          title="Take SyncVibe anywhere with our mobile app"
          imageSrc="https://res.cloudinary.com/dr7lkelwl/image/upload/v1736532162/posts/cyj0itbvmcv2tyaivu8q.webp"
          altText="SyncVibe Mobile App"
        />
      </div>
    </div>
  </section>
);

const ExperienceCard = ({ title, imageSrc, altText }) => (
  <div className="bg-neutral-800/50 backdrop-blur-xl rounded-3xl p-6 lg:p-16 border border-neutral-700/30 shadow-2xl shadow-indigo-500/10 hover:border-neutral-600/50 transition-all">
    <div className="text-center max-w-5xl mx-auto">
      <h2 className="text-xl sm:text-4xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-8 tracking-tight">
        {title}
      </h2>

      <div className="mb-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-pink-500/5 rounded-xl"></div>
        <LazyImage
          src={imageSrc}
          alt={altText}
          className="w-full rounded-xl relative z-10 shadow-2xl transition-all duration-300 hover:scale-[1.01]"
        />
      </div>
    </div>
  </div>
);

export default Home;
