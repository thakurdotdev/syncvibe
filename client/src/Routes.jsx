import React, { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Navigate, useLocation } from "react-router-dom"
import { useIsMobile } from "./hooks/use-mobile"
import { useSidebar } from "./components/ui/sidebar"
import Navbar from "./components/Navbar"
import { AppSidebar } from "./components/AppSidebar"
import IncomingCallNotification from "./components/Chat/IncomingCall"
import VideoCallUI from "./components/Chat/VideoCall"
import UploadIndicator from "./components/Posts/UploadIndicator"
import { Outlet } from "react-router-dom"
import { useContext } from "react"
import { Context } from "./Context/Context"
import { ChatContext } from "./Context/ChatContext"
import GroupMusic from "./Pages/Music/GroupMusic"
import BottomPlayer from "./Pages/Music/BottomPlayer"
import { useProfileSuspenseQuery } from "./hooks/queries/useProfileQuery"

const Header = lazy(() => import("./components/LandingPage/Header"))
const Footer = lazy(() => import("./components/LandingPage/Footer"))

const ProfileLoader = ({ children }) => {
  useProfileSuspenseQuery()
  return children
}

// Lazy-load components
const Login = lazy(() => import("./components/Auth/Login"))
const PasskeyLogin = lazy(() => import("./components/Auth/PassKeyLogin"))
const Profile = lazy(() => import("./components/Auth/Profile"))
const Register = lazy(() => import("./components/Auth/Register"))
const SeeUserProfile = lazy(() => import("./components/Auth/SeeUserProfile"))
const VerifyUser = lazy(() => import("./components/Auth/VerifyUser"))
const Chat = lazy(() => import("./components/Chat/Chat"))
const Home = lazy(() => import("./components/LandingPage/Home"))
const PrivacyPolicy = lazy(() => import("./components/LandingPage/PrivacyPolicy"))
const TermsOfService = lazy(() => import("./components/LandingPage/TermOfService"))
const RefundPolicy = lazy(() => import("./components/LandingPage/RefundPolicy"))
const NotFoundPage = lazy(() => import("./components/NotFound"))
const Dashboard = lazy(() => import("./components/Posts/Dashboard"))
const PostDetail = lazy(() => import("./components/Posts/PostDetail"))
const SearchPost = lazy(() => import("./components/Posts/SearchPost"))
const PostEditor = lazy(() => import("./Pages/Posts/PostEditor"))
const UserPosts = lazy(() => import("./components/Posts/UserPosts"))
const StoryViewer = lazy(() => import("./components/Story/StoryViewer"))
const Album = lazy(() => import("./Pages/Music/Album"))
const Artist = lazy(() => import("./Pages/Music/Artist"))
const HomePage = lazy(() => import("./Pages/Music/Homepage"))
const LanguagePreference = lazy(() => import("./Pages/Music/LanguagePrefrance"))
const Playlist = lazy(() => import("./Pages/Music/Playlist"))
const SearchMusic = lazy(() => import("./Pages/Music/SearchMusic"))
const UserPlaylist = lazy(() => import("./Pages/Music/UserPlaylist"))
const UserPlaylistDetails = lazy(() => import("./Pages/Music/UserPlaylistDetails"))
const HistoryPage = lazy(() => import("./Pages/Music/History"))
const PlansPage = lazy(() => import("./Pages/Plans"))
const PaymentHistoryPage = lazy(() => import("./Pages/PaymentHistory"))

// Fallback loader
const Fallback = () => (
  <div className="flex h-screen items-center justify-center w-full">
    <Loader2 className="w-8 h-8 animate-spin" />
  </div>
)
export const privateRoutes = [
  { path: "/profile", element: <Profile /> },
  { path: "/user/:username", element: <SeeUserProfile /> },
  { path: "/my/posts", element: <UserPosts /> },
  { path: "/feed", element: <Dashboard /> },
  { path: "/feed/post/:postid", element: <PostDetail /> },
  { path: "/post/search", element: <SearchPost /> },
  { path: "/post/create", element: <PostEditor /> },
  { path: "/post/edit/:postid", element: <PostEditor /> },
  { path: "/chat", element: <Chat /> },
  { path: "/stories/:userid", element: <StoryViewer /> },
  { path: "/music", element: <HomePage /> },
  { path: "/music/languages", element: <LanguagePreference /> },
  { path: "/music/search", element: <SearchMusic /> },
  { path: "/music/playlist/:id", element: <Playlist /> },
  { path: "/music/album/:id", element: <Album /> },
  { path: "/music/artist/:id", element: <Artist /> },
  { path: "/music/my-playlist", element: <UserPlaylist /> },
  { path: "/music/my-playlist/:id", element: <UserPlaylistDetails /> },
  { path: "/music/history", element: <HistoryPage /> },
  { path: "/music/sync", element: <GroupMusic /> },
  { path: "/payments/history", element: <PaymentHistoryPage /> },
]

export const publicRoutes = [
  { path: "/", element: <Home /> },
  { path: "/register", element: <Register /> },
  { path: "/verify", element: <VerifyUser /> },
  { path: "/login", element: <Login /> },
  { path: "/passkey-login", element: <PasskeyLogin /> },
  { path: "/privacy-policy", element: <PrivacyPolicy /> },
  { path: "/terms-of-services", element: <TermsOfService /> },
  { path: "/refund-policy", element: <RefundPolicy /> },
  { path: "/plans", element: <PlansPage /> },
  { path: "*", element: <NotFoundPage /> },
]

// Protected Routes Component
export const ProtectedRoutes = () => {
  const { user, loading } = useContext(Context)
  const { open } = useSidebar()
  const isMobile = useIsMobile()
  const { incomingCall, isInCall, answerCall, rejectCall } = useContext(ChatContext)
  const location = useLocation()

  if (loading) {
    return <Fallback />
  }

  if (!user?.email) {
    return <Navigate to={`/login?returnTo=${location.pathname}`} replace />
  }

  if (!user?.verified) {
    return <Navigate to="/verify" state={{ email: user?.email }} replace />
  }

  return (
    <>
      <Navbar />
      <AppSidebar />
      <main
        className={`${
          open && !isMobile ? "w-full max-w-[calc(100%-260px)]" : "w-full"
        } transition-all duration-300`}
      >
        <div className="mt-[60px] h-[calc(100vh-60px)]">
          <Suspense fallback={<Fallback />}>
            <ProfileLoader>
              <Outlet />
            </ProfileLoader>
          </Suspense>
        </div>
      </main>
      <BottomPlayer />
      <IncomingCallNotification
        incomingCall={incomingCall}
        answerCall={answerCall}
        endCall={rejectCall}
      />
      {isInCall && <VideoCallUI />}
      <UploadIndicator />
    </>
  )
}

export const PublicRoutes = () => {
  return (
    <main className="w-full">
      <Header />
      <Suspense fallback={<Fallback />}>
        <Outlet />
      </Suspense>
      <Footer />
    </main>
  )
}
