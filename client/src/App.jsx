import { Route, BrowserRouter as Router, Routes } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import "./App.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ChatProvider } from "./Context/ChatContext"
import { ContextProvider } from "./Context/Context"
import { GroupMusicProvider } from "./Context/GroupMusicContext"
import { PlayerProvider } from "./Context/PlayerContext"
import { ThemeProvider } from "./Context/ThemeProvider"
import { Toaster } from "./components/ui/sonner"
import { ProtectedRoutes, PublicRoutes, privateRoutes, publicRoutes } from "./Routes"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <SidebarProvider>
            <ContextProvider>
              <PlayerProvider>
                <ChatProvider>
                  <GroupMusicProvider>
                    <Toaster position="bottom-right" />

                    <Routes>
                      <Route element={<ProtectedRoutes />}>
                        {privateRoutes.map((route) => (
                          <Route key={route.path} path={route.path} element={route.element} />
                        ))}
                      </Route>

                      <Route element={<PublicRoutes />}>
                        {publicRoutes.map((route) => (
                          <Route key={route.path} path={route.path} element={route.element} />
                        ))}
                      </Route>
                    </Routes>
                  </GroupMusicProvider>
                </ChatProvider>
              </PlayerProvider>
            </ContextProvider>
          </SidebarProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App
