import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { useNavigate } from "react-router-dom"
import SimpleBar from "simplebar-react"
import "simplebar-react/dist/simplebar.min.css"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "../ui/dialog"

const Followers = ({ followers }) => {
  const navigate = useNavigate()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          disabled={followers.length === 0}
          className="px-4 py-2 rounded-full"
          variant="outline"
        >
          {followers.length} Followers
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Followers</DialogHeader>

        <SimpleBar style={{ maxHeight: "70vh" }}>
          {followers.map((follow) => (
            <DialogTrigger asChild>
              <div
                key={follow?.id}
                onClick={() => {
                  navigate(`/user/${follow?.followerDetail?.username}`, {
                    state: { user: follow?.followerDetail },
                  })
                }}
                className="flex items-center p-2 hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Avatar>
                  <AvatarImage
                    src={getProfileCloudinaryUrl(follow?.followerDetail?.profilepic)}
                    alt={follow?.followerDetail?.name}
                    className="rounded-full w-12 h-12"
                  />
                  <AvatarFallback>
                    {follow?.followerDetail?.name[0]}
                    {follow?.followerDetail?.name[1]}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4">
                  {follow?.followerDetail?.name}

                  <p className="text-sm text-neutral-500">@{follow?.followerDetail?.username}</p>
                </div>
              </div>
            </DialogTrigger>
          ))}
        </SimpleBar>
      </DialogContent>
    </Dialog>
  )
}

export default Followers
