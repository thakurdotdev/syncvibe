import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useContext } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { Context } from './Context/Context';
import AuthLayout from './components/Auth/AuthLayout';
import AppShell from './components/shell/AppShell';
import GroupMusic from './Pages/GroupMusic/GroupMusic';
import { paths } from './lib/paths';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import VerifyUser from './components/Auth/VerifyUser';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';

const Header = lazy(() => import('./components/LandingPage/Header'));
const Footer = lazy(() => import('./components/LandingPage/Footer'));

// Lazy-load components
const Profile = lazy(() => import('./components/Auth/Profile'));
const SeeUserProfile = lazy(() => import('./components/Auth/SeeUserProfile'));
const Chat = lazy(() => import('./components/Chat/Chat'));
const Home = lazy(() => import('./components/LandingPage/Home'));
const PrivacyPolicy = lazy(() => import('./components/LandingPage/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/LandingPage/TermOfService'));
const RefundPolicy = lazy(() => import('./components/LandingPage/RefundPolicy'));
const NotFoundPage = lazy(() => import('./components/NotFound'));
const Album = lazy(() => import('./Pages/Music/Album'));
const Artist = lazy(() => import('./Pages/Music/Artist'));
const HomePage = lazy(() => import('./Pages/Music/Homepage'));
const LanguagePreference = lazy(() => import('./Pages/Music/LanguagePrefrance'));
const Playlist = lazy(() => import('./Pages/Music/Playlist'));
const UserPlaylistDetails = lazy(() => import('./Pages/Music/UserPlaylistDetails'));
const LibraryPage = lazy(() => import('./Pages/Library'));
const PlansPage = lazy(() => import('./Pages/Plans'));
const PaymentHistoryPage = lazy(() => import('./Pages/PaymentHistory'));
const PublishUpdate = lazy(() => import('./Pages/Admin/PublishUpdate'));
const ReleasesPage = lazy(() => import('./Pages/Releases'));

// Fallback loader
const Fallback = () => (
  <div className='flex h-screen items-center justify-center w-full'>
    <Loader2 className='w-8 h-8 animate-spin' />
  </div>
);

/**
 * Posts and stories are no longer part of the product. Their components stay in the codebase,
 * but every old URL now lands somewhere useful.
 */
const LegacyRedirect = ({ to }) => {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={`${typeof to === 'function' ? to(params) : to}${search}`} replace />;
};

export const privateRoutes = [
  { path: paths.home, element: <HomePage /> },
  { path: paths.rooms, element: <GroupMusic /> },
  { path: paths.messages, element: <Chat /> },
  { path: paths.library, element: <LibraryPage tab='playlists' /> },
  { path: paths.history, element: <LibraryPage tab='history' /> },
  { path: '/library/playlist/:id', element: <UserPlaylistDetails /> },
  { path: '/playlist/:id', element: <Playlist /> },
  { path: '/album/:id', element: <Album /> },
  { path: '/artist/:id', element: <Artist /> },
  { path: paths.profile, element: <Profile /> },
  { path: '/u/:username', element: <SeeUserProfile /> },
  { path: paths.languages, element: <LanguagePreference /> },
  { path: paths.billing, element: <PaymentHistoryPage /> },
  { path: '/admin/updates', element: <PublishUpdate /> },

  // Old URLs
  { path: '/music', element: <LegacyRedirect to={paths.home} /> },
  { path: '/music/sync', element: <LegacyRedirect to={paths.rooms} /> },
  { path: '/chat', element: <LegacyRedirect to={paths.messages} /> },
  { path: '/music/my-playlist', element: <LegacyRedirect to={paths.library} /> },
  {
    path: '/music/my-playlist/:id',
    element: <LegacyRedirect to={({ id }) => paths.myPlaylist(id)} />,
  },
  { path: '/music/history', element: <LegacyRedirect to={paths.history} /> },
  { path: '/music/playlist/:id', element: <LegacyRedirect to={({ id }) => paths.playlist(id)} /> },
  { path: '/music/album/:id', element: <LegacyRedirect to={({ id }) => paths.album(id)} /> },
  { path: '/music/artist/:id', element: <LegacyRedirect to={({ id }) => paths.artist(id)} /> },
  { path: '/music/languages', element: <LegacyRedirect to={paths.languages} /> },
  { path: '/payments/history', element: <LegacyRedirect to={paths.billing} /> },
  {
    path: '/user/:username',
    element: <LegacyRedirect to={({ username }) => paths.user(username)} />,
  },
  { path: '/feed/*', element: <LegacyRedirect to={paths.home} /> },
  { path: '/post/*', element: <LegacyRedirect to={paths.home} /> },
  { path: '/my/posts', element: <LegacyRedirect to={paths.home} /> },
  { path: '/stories/:userid', element: <LegacyRedirect to={paths.home} /> },
];

export const publicRoutes = [
  { path: '/', element: <Home /> },
  { path: '/download', element: <ReleasesPage /> },
  { path: '/releases', element: <ReleasesPage /> },
  { path: '/register', element: <Register /> },
  { path: '/verify', element: <VerifyUser /> },
  { path: '/login', element: <Login /> },
  // Passkey sign-in starts from the login page. Old links to this page land there.
  { path: '/passkey-login', element: <Navigate to='/login' replace /> },
  { path: '/privacy-policy', element: <PrivacyPolicy /> },
  { path: '/terms-of-services', element: <TermsOfService /> },
  { path: '/refund-policy', element: <RefundPolicy /> },
  { path: '/plans', element: <PlansPage /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '*', element: <NotFoundPage /> },
];

// Protected Routes Component
export const ProtectedRoutes = () => {
  const { user, loading } = useContext(Context);
  const location = useLocation();

  if (loading) {
    return <Fallback />;
  }

  if (!user?.email) {
    return <Navigate to={`/login?returnTo=${location.pathname}`} replace />;
  }

  if (!user?.verified) {
    return <Navigate to='/verify' state={{ email: user?.email }} replace />;
  }

  return <AppShell />;
};

export const PublicRoutes = () => {
  const location = useLocation();
  const noHeaderFooterRoutes = [
    '/login',
    '/register',
    '/verify',
    '/forgot-password',
    '/reset-password',
  ];
  const hideHeaderFooter = noHeaderFooterRoutes.includes(location.pathname);

  if (hideHeaderFooter) {
    return <AuthLayout />;
  }

  return (
    <main className='w-full'>
      <Header />
      <Suspense fallback={<Fallback />}>
        <Outlet />
      </Suspense>
      <Footer />
    </main>
  );
};
