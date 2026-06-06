import MusicCommand from "@/Pages/Music/MusicCommand"
import ProfileDropdownMenu from "./ProfileDropdownMenu"
import { SidebarTrigger } from "./ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import LazyImage from "./LazyImage"

const MusicNavbar = () => {
  const isMobile = useIsMobile()

  return (
    <nav
      className="fixed top-0 w-full z-10 h-14 liquid-glass border-t-0 border-x-0"
      style={{ borderRadius: 0 }}
    >
      <div className="h-full mx-auto px-4">
        <div className="flex items-center justify-between h-full sm:ml-64">
          {isMobile ? (
            <LazyImage
              src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg"
              alt="SyncVibe"
              className="h-7 w-7 shrink-0"
              height={28}
              width={28}
            />
          ) : (
            <SidebarTrigger />
          )}
          <div className="flex-1 flex items-center justify-center px-2 sm:px-6">
            <MusicCommand />
          </div>
          <ProfileDropdownMenu fromSidebar={false} />
        </div>
      </div>
    </nav>
  )
}

export default MusicNavbar
