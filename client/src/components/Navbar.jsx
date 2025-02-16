import MusicCommand from "@/Pages/Music/MusicCommand";
import CreatePost from "./Posts/CreatePost";
import ProfileDropdownMenu from "./ProfileDropdownMenu";
import { Card } from "./ui/card";
import { SidebarTrigger } from "./ui/sidebar";

const Navbar = () => {
  return (
    <Card className="fixed top-0 w-full z-10 rounded-none backdrop-blur-sm bg-opacity-20 h-14">
      <div className="mx-auto px-4">
        <div className="flex justify-between items-center py-1 sm:ml-[16rem]">
          <SidebarTrigger />

          <div className="flex items-center gap-3">
            <MusicCommand />
          </div>
          <div className="flex items-center gap-3">
            <CreatePost />
            <ProfileDropdownMenu fromSidebar={false} />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default Navbar;
