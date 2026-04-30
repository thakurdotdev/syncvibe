import MusicCommand from "@/Pages/Music/MusicCommand"
import ProfileDropdownMenu from "./ProfileDropdownMenu"
import { SidebarTrigger } from "./ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import LazyImage from "./LazyImage"

const MusicNavbar = () => {
  const isMobile = useIsMobile()

  return (
    <nav className="fixed top-0 w-full z-10 h-14 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="h-full mx-auto px-4">
        <div className="flex items-center justify-between h-full sm:ml-64">
          {isMobile ? (
            <LazyImage
              src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
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
