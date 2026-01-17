import { memo, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import he from "he"

const SongInfo = memo(({ currentSong, onOpenSheet }) => {
  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png",
    [currentSong],
  )

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  )

  return (
    <div
      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        onOpenSheet()
      }}
    >
      <Avatar className="h-14 w-14 rounded-md">
        <AvatarImage src={songImage} alt={currentSong.name} />
        <AvatarFallback>MU</AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-medium truncate">{he.decode(currentSong.name)}</p>
        <p className="text-xs text-muted-foreground truncate">{he.decode(artistName)}</p>
      </div>
    </div>
  )
})

SongInfo.displayName = "SongInfo"
export default SongInfo
