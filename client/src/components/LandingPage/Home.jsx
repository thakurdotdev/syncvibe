import {
  ChevronsDown,
  Loader2,
  MessageCircle,
  Music2,
  Share2,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import LazyImage from "../LazyImage";
import { Button } from "../ui/button";
import { FlipWords } from "../ui/flip-words";
import { HoverBorderGradient } from "../ui/hover-border-gradient";
import { useProfile } from "@/Context/Context";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const FeatureCard = lazy(() => import("./FeatureCard"));
const FAQ = lazy(() => import("./FAQ"));
const Newsletter = lazy(() => import("./Newsletter"));

const Home = () => {
  const { user, loading } = useProfile();
  const navigate = useNavigate();
  const words = ["Vibe", "Moments", "Music", "Life"];

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
    <div className="relative ">
      <main className="relative">
        <Hero words={words} />
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

const Hero = ({ words }) => (
  <section className="h-screen flex flex-col items-center px-4 sm:px-6 lg:px-8 relative">
    <div className=" z-10 text-center space-y-8 max-w-5xl flex items-center flex-col mx-auto mt-[200px]">
      <HoverBorderGradient
        containerClassName="rounded-full"
        as="button"
        className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2"
      >
        <span>🎉</span>
        <span>
          Introducing <span className="text-gradient">SyncVibe</span>
        </span>
      </HoverBorderGradient>

      <h1 className="text-2xl md:text-5xl font-bold text-transparent max-sm:flex bg-clip-text bg-gradient-to-r from-white to-gray-400">
        Where You Can Sync
        <div className="">
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
          <Button className="rounded-full px-8 py-6 text-lg">
            Start Syncing Now
          </Button>
        </Link>
      </div>

      <div className="absolute bottom-32 animate-bounce">
        <span className="text-white text-3xl">
          <ChevronsDown className="w-8 h-8" />
        </span>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="py-32 bg-gradient-to-b from-black to-purple-900/20">
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
            <div className="h-screen flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto" />
            </div>
          }
        >
          <FeatureCard
            icon={Music2}
            title="Listen to favorite music"
            description="Listen to music in perfect harmony with friends, no matter where they are"
          />
          <FeatureCard
            icon={Video}
            title="HD Video Calls"
            description="Experience high-quality video calls with friends and family"
          />
          <FeatureCard
            icon={MessageCircle}
            title="Real-time Chat"
            description="Stay connected with instant messaging and reactions"
          />
          <FeatureCard
            icon={Share2}
            title="Share Stories"
            description="Share your favorite moments and memories with friends"
          />
          <FeatureCard
            icon={Zap}
            title="Share your thoughts and feelings"
            description="Express yourself with emojis, stickers, and reactions"
          />
          <FeatureCard
            icon={Users}
            title="Create Private Playlists"
            description="Create private playlists and share them with friends"
          />
        </Suspense>
      </div>
    </div>
  </section>
);

const Experience = () => (
  <section className="py-32">
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
      </div>
    </div>
  </section>
);

const ExperienceCard = ({ title, imageSrc, altText }) => (
  <div className="bg-neutral-800/70 backdrop-blur-xl rounded-3xl p-6 lg:p-16 border border-neutral-700/50 shadow-2xl shadow-indigo-500/10">
    <div className="text-center max-w-5xl mx-auto">
      <h2 className="text-xl sm:text-4xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-8 tracking-tight">
        {title}
      </h2>

      <div className="mb-4">
        <LazyImage
          src={imageSrc}
          alt={altText}
          className="w-full rounded-xl relative z-10 shadow-2xl transition-opacity duration-300 opacity-100"
        />
      </div>
    </div>
  </div>
);

export default Home;
