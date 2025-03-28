import React from "react";
import { Home, Music, ListMusic, Send } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "@/Context/ChatContext";

const MobileBottomBar = () => {
  const { currentChat } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide the bottom bar on chat routes
  if (location.pathname === "/chat" && currentChat) {
    return null;
  }

  const menuItems = [
    { name: "Home", icon: Home, path: "/feed" },
    { name: "Music", icon: Music, path: "/music" },
    { name: "Playlists", icon: ListMusic, path: "/music/my-playlist" },
    { name: "Messages", icon: Send, path: "/chat" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 z-50">
      {/* Backdrop blur effect */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md border-t border-border" />

      {/* Navigation items */}
      <div className="relative h-full flex items-center justify-around">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center w-full h-full"
            >
              <div
                className={`flex flex-col items-center justify-center ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 mb-1 ${
                    isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"
                  }`}
                />
                <span className="text-xs font-medium">{item.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomBar;
