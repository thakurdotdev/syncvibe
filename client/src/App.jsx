import { SidebarProvider } from '@/components/ui/sidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import { Toaster } from './components/ui/sonner';
import { ChatProvider } from './Context/ChatContext';
import { ContextProvider } from './Context/Context';
import { GroupMusicProvider } from './Context/GroupMusicContext';
import { PlayerProvider } from './Context/PlayerContext';
import { ThemeProvider } from './Context/ThemeProvider';
import {
  ProtectedRoutes,
  PublicRoutes,
  musicOnlyRoutes,
  privateRoutes,
  publicRoutes,
} from './Routes';
import { useAppModeStore } from './stores/appModeStore';
import { setQueryClient } from './stores/uploadStore';

const queryClient = new QueryClient();
setQueryClient(queryClient);

function AppRoutes() {
  const mode = useAppModeStore((s) => s.mode);
  const activePrivateRoutes = mode === 'music' ? musicOnlyRoutes : privateRoutes;

  return (
    <Routes>
      <Route element={<ProtectedRoutes />}>
        {activePrivateRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Route>

      <Route element={<PublicRoutes />}>
        {publicRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
          <SidebarProvider>
            <ContextProvider>
              <PlayerProvider>
                <ChatProvider>
                  <GroupMusicProvider>
                    <Toaster position='bottom-right' />
                    <AppRoutes />
                  </GroupMusicProvider>
                </ChatProvider>
              </PlayerProvider>
            </ContextProvider>
          </SidebarProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
