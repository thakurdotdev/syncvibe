import { SidebarProvider } from "@/components/ui/sidebar";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import { Toaster } from "./components/ui/sonner";
import { ChatProvider } from "./Context/ChatContext";
import { ContextProvider } from "./Context/Context";
import { PlayerProvider } from "./Context/PlayerContext";
import { ThemeProvider } from "./Context/ThemeProvider";
import {
  privateRoutes,
  ProtectedRoutes,
  PublicRoutes,
  publicRoutes,
} from "./Routes";

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SidebarProvider>
          <ContextProvider>
            <PlayerProvider>
              <ChatProvider>
                <Toaster position="bottom-right" />

                <Routes>
                  <Route element={<ProtectedRoutes />}>
                    {privateRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                      />
                    ))}
                  </Route>

                  <Route element={<PublicRoutes />}>
                    {publicRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                      />
                    ))}
                  </Route>
                </Routes>
              </ChatProvider>
            </PlayerProvider>
          </ContextProvider>
        </SidebarProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
