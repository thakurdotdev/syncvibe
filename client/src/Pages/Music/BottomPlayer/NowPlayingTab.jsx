import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SheetTitle } from "@/components/ui/sheet"
import he from "he"
import { ChevronRight, Music } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { MusicControls, ProgressBarMusic } from "../Common"

const useImageColors = (imageSrc) => {
  const [colors, setColors] = useState(null)
  const canvasRef = useRef(null)
  const prevSrc = useRef(null)

  const extractColors = useCallback((src) => {
    if (!src || src === prevSrc.current) return
    prevSrc.current = src
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
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if ((r + g + b) / 3 < 20 || (r + g + b) / 3 > 235) continue
        if ((max - min) < 12) continue
        const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`
        buckets[key] = (buckets[key] || 0) + 1
      }

      const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1])
      const adjust = (rgb) => {
        const [r, g, b] = rgb
        const avg = (r + g + b) / 3
        return [
          Math.min(255, Math.round(r + (r - avg) * 0.25)),
          Math.min(255, Math.round(g + (g - avg) * 0.25)),
          Math.min(255, Math.round(b + (b - avg) * 0.25)),
        ]
      }

      const parse = (s) => s.split(",").map(Number)
      const c1 = sorted[0] ? adjust(parse(sorted[0][0])) : [90, 70, 130]
      const c2 = sorted[1] ? adjust(parse(sorted[1][0])) : [130, 70, 90]
      const c3 = sorted[2] ? adjust(parse(sorted[2][0])) : [70, 110, 130]

      setColors({ c1, c2, c3 })
    }
    img.src = src
  }, [])

  useEffect(() => {
    extractColors(imageSrc)
  }, [imageSrc, extractColors])

  return colors
}

const useCrossfadeImage = (src) => {
  const [images, setImages] = useState({ current: src, previous: null, transitioning: false })
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (src && src !== images.current) {
      setImages((prev) => ({ current: src, previous: prev.current, transitioning: true }))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setImages((prev) => ({ ...prev, previous: null, transitioning: false }))
      }, 600)
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [src])

  return images
}

const useNextSong = (currentSong) => {
  const playlist = usePlayerStore((s) => s.playlist)
  return useMemo(() => {
    if (!playlist.length || !currentSong) return null
    const idx = playlist.findIndex((s) => s.id === currentSong.id)
    if (idx === -1 || idx >= playlist.length - 1) return null
    return playlist[idx + 1]
  }, [playlist, currentSong])
}

const UpNextHint = memo(({ nextSong }) => {
  const nextImage = nextSong?.image?.[1]?.link
  const nextName = nextSong?.name ? he.decode(nextSong.name) : ""
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)

  if (!nextSong) return null

  return (
    <button
      type="button"
      onClick={() => handleNextSong(false)}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 hover:bg-white/[0.07] active:scale-[0.98] cursor-pointer w-full max-w-sm"
    >
      <Avatar className="w-10 h-10 rounded-lg shrink-0 ring-1 ring-white/[0.06]">
        <AvatarImage src={nextImage} alt={nextName} className="object-cover" />
        <AvatarFallback className="rounded-lg bg-white/5 text-xs">
          <Music className="w-4 h-4 text-white/20" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-0.5 font-medium">Next</p>
        <p className="text-sm text-white/55 truncate group-hover:text-white/80 transition-colors duration-200">{nextName}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
    </button>
  )
})
UpNextHint.displayName = "UpNextHint"

const CrossfadeAvatar = memo(({ images, size, shadow, name }) => (
  <div className="relative np-img-hover" style={{ width: size, height: size }}>
    {images.previous && (
      <Avatar
        className="rounded-2xl absolute inset-0"
        style={{ width: size, height: size, boxShadow: shadow }}
      >
        <AvatarImage
          src={images.previous}
          className="object-cover np-fade-out"
        />
      </Avatar>
    )}
    <Avatar
      className="rounded-2xl relative"
      style={{ width: size, height: size, boxShadow: shadow }}
    >
      <AvatarImage
        src={images.current}
        alt={name}
        className={`object-cover ${images.transitioning ? "np-fade-in" : ""}`}
      />
      <AvatarFallback className="text-6xl bg-white/5">
        <Music className="w-24 h-24 text-white/20" />
      </AvatarFallback>
    </Avatar>
  </div>
))
CrossfadeAvatar.displayName = "CrossfadeAvatar"

const NowPlayingTab = memo(({ currentSong }) => {
  const songImage = useMemo(() => currentSong?.image?.[2]?.link, [currentSong])
  const colors = useImageColors(songImage)
  const images = useCrossfadeImage(songImage)
  const nextSong = useNextSong(currentSong)
  const hasAnimated = useRef(false)
  const [showEntrance, setShowEntrance] = useState(false)
  const [textKey, setTextKey] = useState(0)
  const prevSongId = useRef(currentSong?.id)

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true
      requestAnimationFrame(() => setShowEntrance(true))
    }
  }, [])

  useEffect(() => {
    if (currentSong?.id !== prevSongId.current) {
      prevSongId.current = currentSong?.id
      setTextKey((k) => k + 1)
    }
  }, [currentSong?.id])

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  )

  const c1 = colors?.c1 || [35, 30, 45]
  const c2 = colors?.c2 || [30, 35, 40]

  const imgShadowDesktop = `0 30px 80px rgba(0,0,0,0.5), 0 0 80px -20px rgba(${c1[0]},${c1[1]},${c1[2]},0.2)`
  const imgShadowMobile = `0 24px 60px rgba(0,0,0,0.5), 0 0 60px -15px rgba(${c1[0]},${c1[1]},${c1[2]},0.2)`

  const orbColor = (c, a) => ({
    background: `rgba(${c[0]},${c[1]},${c[2]},${a})`,
    transition: "background 2s ease-out",
  })

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#050505]">
      {/* Blurred album art background */}
      {images.previous && (
        <div
          className="absolute inset-0 bg-cover bg-center np-bg-fade-out"
          style={{ backgroundImage: `url(${images.previous})`, filter: "blur(60px) saturate(1.2) brightness(0.6)", transform: "scale(1.5)" }}
        />
      )}
      <div
        className={`absolute inset-0 bg-cover bg-center ${images.transitioning ? "np-bg-fade-in" : ""}`}
        style={{ backgroundImage: `url(${images.current})`, filter: "blur(60px) saturate(1.2) brightness(0.6)", transform: "scale(1.5)", transition: "background-image 0.5s ease" }}
      />

      {/* Animated orbs for subtle movement */}
      <div className="absolute inset-0 np-orb-layer">
        <div className="np-orb np-o1" style={orbColor(c1, 0.25)} />
        <div className="np-orb np-o2" style={orbColor(c2, 0.2)} />
      </div>

      {/* Dark overlay + vignette */}
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(5,5,5,0.4) 65%, rgba(5,5,5,0.85) 100%)"
      }} />

      {/* Desktop layout */}
      <div className="hidden lg:flex relative z-10 h-full w-full max-w-[1100px] mx-auto items-center gap-14 xl:gap-20 px-10 xl:px-16">
        <div
          className="shrink-0 transition-all duration-500 ease-out"
          style={{
            opacity: showEntrance ? 1 : 0,
            transform: showEntrance ? "scale(1)" : "scale(0.93)",
          }}
        >
          <CrossfadeAvatar
            images={images}
            size="min(40vw, 55vh, 440px)"
            shadow={imgShadowDesktop}
            name={currentSong.name}
          />
        </div>

        <div
          className="flex-1 flex flex-col gap-6 min-w-0 transition-all duration-600 ease-out"
          style={{
            opacity: showEntrance ? 1 : 0,
            transform: showEntrance ? "translateY(0)" : "translateY(20px)",
            transitionDelay: "0.15s",
          }}
        >
          <div key={textKey} className="space-y-2 np-text-in">
            <SheetTitle className="text-3xl xl:text-[2.5rem] font-bold line-clamp-2 text-white tracking-tight leading-[1.15]">
              {he.decode(currentSong.name)}
            </SheetTitle>
            <p className="text-base xl:text-lg text-white/50 line-clamp-1">{he.decode(artistName)}</p>
            {currentSong?.album?.name && (
              <p className="text-sm text-white/25 mt-1">
                {he.decode(currentSong.album.name)}
              </p>
            )}
          </div>

          <div className="max-w-lg space-y-4">
            <ProgressBarMusic isTimeVisible={true} />
            <MusicControls size="large" />
          </div>

          {nextSong && (
            <div className="pt-3 border-t border-white/[0.05]">
              <UpNextHint nextSong={nextSong} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden relative z-10 h-full flex flex-col items-center justify-between px-6 sm:px-8 pt-16 pb-8">
        <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full max-w-sm">
          <div
            className="shrink-0 transition-all duration-500 ease-out"
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? "scale(1)" : "scale(0.93)",
            }}
          >
            <CrossfadeAvatar
              images={images}
              size="min(80vw, 42vh, 360px)"
              shadow={imgShadowMobile}
              name={currentSong.name}
            />
          </div>

          <div
            className="w-full space-y-4 transition-all duration-500 ease-out"
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? "translateY(0)" : "translateY(16px)",
              transitionDelay: "0.12s",
            }}
          >
            <div key={textKey} className="text-center space-y-1 np-text-in">
              <SheetTitle className="text-xl sm:text-2xl font-bold line-clamp-2 text-white tracking-tight leading-snug">
                {he.decode(currentSong.name)}
              </SheetTitle>
              <p className="text-sm text-white/50 line-clamp-1">{he.decode(artistName)}</p>
              {currentSong?.album?.name && (
                <p className="text-xs text-white/25">
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

        {nextSong && (
          <div
            className="w-full max-w-sm pt-2 transition-all duration-500 ease-out"
            style={{
              opacity: showEntrance ? 1 : 0,
              transform: showEntrance ? "translateY(0)" : "translateY(10px)",
              transitionDelay: "0.25s",
            }}
          >
            <UpNextHint nextSong={nextSong} />
          </div>
        )}
      </div>

      <style>{`
        .np-orb-layer {
          filter: blur(80px);
          transform: scale(1.3);
          mix-blend-mode: soft-light;
          opacity: 0.8;
        }
        .np-orb {
          position: absolute;
          border-radius: 50%;
        }
        .np-o1 {
          width: 60%;
          height: 65%;
          top: -10%;
          left: -10%;
          animation: npo1 24s ease-in-out infinite;
        }
        .np-o2 {
          width: 55%;
          height: 55%;
          bottom: -10%;
          right: -10%;
          animation: npo2 28s ease-in-out infinite;
        }
        @keyframes npo1 {
          0%, 100% { transform: translate(0, 0) scale(1); border-radius: 50%; }
          33% { transform: translate(12%, 18%) scale(1.06); border-radius: 44% 56% 52% 48%; }
          66% { transform: translate(6%, 10%) scale(0.97); border-radius: 48% 52% 46% 54%; }
        }
        @keyframes npo2 {
          0%, 100% { transform: translate(0, 0) scale(1); border-radius: 50%; }
          33% { transform: translate(-10%, -14%) scale(1.05); border-radius: 54% 46% 48% 52%; }
          66% { transform: translate(-16%, -6%) scale(0.96); border-radius: 47% 53% 52% 48%; }
        }
        .np-bg-fade-in {
          animation: npBgIn 0.8s ease-out both;
        }
        .np-bg-fade-out {
          animation: npBgOut 0.8s ease-out both;
        }
        @keyframes npBgIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes npBgOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .np-img-hover { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .np-img-hover:hover { transform: scale(1.02); }
        .np-fade-in {
          animation: npFadeIn 0.5s ease-out both;
        }
        .np-fade-out {
          animation: npFadeOut 0.5s ease-out both;
        }
        @keyframes npFadeIn {
          from { opacity: 0; transform: scale(1.03); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes npFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .np-text-in {
          animation: npTextIn 0.4s ease-out both;
        }
        @keyframes npTextIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .np-orb, .np-fade-in, .np-fade-out, .np-text-in, .np-bg-fade-in, .np-bg-fade-out { animation: none !important; }
          .np-fade-in, .np-text-in, .np-bg-fade-in { opacity: 1 !important; }
          .np-fade-out, .np-bg-fade-out { opacity: 0 !important; }
        }
      `}</style>
    </div>
  )
})

NowPlayingTab.displayName = "NowPlayingTab"
export default NowPlayingTab
