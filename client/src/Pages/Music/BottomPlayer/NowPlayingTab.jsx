import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SheetTitle } from "@/components/ui/sheet"
import he from "he"
import { Music } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MusicControls, ProgressBarMusic } from "../Common"

const useImageColors = (imageSrc) => {
  const [colors, setColors] = useState(null)
  const canvasRef = useRef(null)

  const extractColors = useCallback((src) => {
    if (!src) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas")
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      canvas.width = 32
      canvas.height = 32
      ctx.drawImage(img, 0, 0, 32, 32)
      const data = ctx.getImageData(0, 0, 32, 32).data

      const buckets = {}
      for (let i = 0; i < data.length; i += 8) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const brightness = (r + g + b) / 3
        if (brightness < 15 || brightness > 245) continue
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        if (sat < 12) continue
        const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`
        buckets[key] = (buckets[key] || 0) + 1
      }

      const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1])
      const boost = (c) => c.map((v) => {
        const avg = (c[0] + c[1] + c[2]) / 3
        return Math.min(255, Math.round(v + (v - avg) * 0.5 + 30))
      })

      const c1 = sorted[0] ? boost(sorted[0][0].split(",").map(Number)) : [120, 80, 200]
      const c2 = sorted[1] ? boost(sorted[1][0].split(",").map(Number)) : [200, 80, 120]
      const c3 = sorted[2] ? boost(sorted[2][0].split(",").map(Number)) : c1.map((v, i) => Math.round((v + c2[i]) / 2))

      setColors({ c1, c2, c3 })
    }
    img.src = src
  }, [])

  useEffect(() => {
    extractColors(imageSrc)
  }, [imageSrc, extractColors])

  return colors
}

const NowPlayingTab = memo(({ currentSong }) => {
  const songImage = useMemo(() => currentSong?.image?.[2]?.link, [currentSong])
  const colors = useImageColors(songImage)

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  )

  const c1 = colors?.c1 || [30, 30, 30]
  const c2 = colors?.c2 || [20, 20, 20]
  const c3 = colors?.c3 || [25, 25, 25]

  const bgGradient = useMemo(() => `
    radial-gradient(ellipse 80% 80% at 15% 10%, rgba(${c1[0]},${c1[1]},${c1[2]},0.7) 0%, transparent 60%),
    radial-gradient(ellipse 70% 90% at 85% 85%, rgba(${c2[0]},${c2[1]},${c2[2]},0.6) 0%, transparent 55%),
    radial-gradient(ellipse 60% 60% at 55% 45%, rgba(${c3[0]},${c3[1]},${c3[2]},0.4) 0%, transparent 50%),
    radial-gradient(ellipse 90% 50% at 30% 90%, rgba(${c2[0]},${c2[1]},${c2[2]},0.35) 0%, transparent 55%),
    radial-gradient(ellipse 50% 80% at 80% 20%, rgba(${c1[0]},${c1[1]},${c1[2]},0.3) 0%, transparent 50%),
    black
  `, [c1, c2, c3])

  const glowBg = useMemo(
    () => `radial-gradient(circle, rgba(${c1[0]},${c1[1]},${c1[2]},0.5) 0%, transparent 70%)`,
    [c1],
  )

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
      <div
        className="absolute inset-0 np-gradient-bg"
        style={{ background: bgGradient }}
      />

      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10 flex flex-col items-center w-full h-full justify-center px-6 sm:px-10 py-20 gap-6 sm:gap-8 max-w-xl mx-auto">
        <div className="relative group shrink-0">
          <div
            className="absolute -inset-6 rounded-3xl opacity-60 group-hover:opacity-80 transition-opacity duration-500"
            style={{ background: glowBg }}
          />
          <Avatar
            className="rounded-2xl relative z-10"
            style={{
              width: "min(85vw, 50vh, 520px)",
              height: "min(85vw, 50vh, 520px)",
              boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(${c1[0]},${c1[1]},${c1[2]},0.2)`,
            }}
          >
            <AvatarImage src={songImage} alt={currentSong.name} className="object-cover" />
            <AvatarFallback className="text-6xl bg-white/5">
              <Music className="w-24 h-24 text-white/30" />
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex flex-col gap-5 text-center w-full">
          <div>
            <SheetTitle className="text-2xl sm:text-3xl font-bold mb-2 line-clamp-2 text-white drop-shadow-lg">
              {he.decode(currentSong.name)}
            </SheetTitle>
            <p className="text-sm sm:text-base text-white/60 line-clamp-1 font-medium">{he.decode(artistName)}</p>
            {currentSong?.album?.name && (
              <p className="text-xs sm:text-sm text-white/35 mt-1.5 font-light">
                {he.decode(currentSong.album.name)}
              </p>
            )}
          </div>

          <ProgressBarMusic isTimeVisible={true} />

          <div className="flex justify-center">
            <MusicControls size="large" />
          </div>
        </div>
      </div>

      <style>{`
        .np-gradient-bg {
          transition: background 2s ease;
          animation: npShift 20s ease-in-out infinite alternate;
        }
        @keyframes npShift {
          0%   { filter: hue-rotate(0deg) brightness(1); transform: scale(1); }
          25%  { filter: hue-rotate(8deg) brightness(1.1); transform: scale(1.05); }
          50%  { filter: hue-rotate(-5deg) brightness(0.95); transform: scale(1.02); }
          75%  { filter: hue-rotate(12deg) brightness(1.05); transform: scale(1.08); }
          100% { filter: hue-rotate(-8deg) brightness(1); transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .np-gradient-bg { animation: none; }
        }
      `}</style>
    </div>
  )
})

NowPlayingTab.displayName = "NowPlayingTab"
export default NowPlayingTab
