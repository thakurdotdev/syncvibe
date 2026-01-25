import he from "he"
import { Music } from "lucide-react"
import { memo, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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

  const decodedName = useMemo(() => he.decode(currentSong?.name || ""), [currentSong])
  const decodedArtist = useMemo(() => he.decode(artistName), [artistName])

  return (
    <button
      type="button"
      className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer group text-left bg-transparent border-none p-0"
      onClick={(e) => {
        e.stopPropagation()
        onOpenSheet()
      }}
    >
      <div className="relative">
        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg relative ring-1 ring-white/10">
          <AvatarImage src={songImage} alt={currentSong?.name} className="object-cover" />
          <AvatarFallback className="bg-white/5">
            <Music className="w-5 h-5 text-white/40" />
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-col min-w-0 flex-1 max-w-[140px] sm:max-w-[200px]">
        <div className="overflow-hidden">
          <p className="text-sm font-semibold text-white truncate">{decodedName}</p>
        </div>
        <p className="text-xs text-white/50 truncate">{decodedArtist}</p>
      </div>
    </button>
  )
})

SongInfo.displayName = "SongInfo"
export default SongInfo
