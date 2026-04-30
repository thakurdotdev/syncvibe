import { LayoutDashboard, Headphones } from "lucide-react"
import { useAppModeStore } from "@/stores/appModeStore"
import LazyImage from "./LazyImage"

const ModeChooser = () => {
  const setMode = useAppModeStore((s) => s.setMode)

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-10 max-w-lg w-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <LazyImage
            src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
            alt="SyncVibe"
            className="h-12 w-12"
            height={48}
            width={48}
          />
          <h1 className="text-2xl font-bold tracking-tight">Choose your experience</h1>
          <p className="text-sm text-muted-foreground">You can switch anytime from your profile menu.</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => setMode("normal")}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all text-left"
          >
            <div className="h-11 w-11 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors flex-shrink-0">
              <LayoutDashboard className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-semibold">Full Experience</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Feed, messaging, music, and everything else
              </p>
            </div>
          </button>

          <button
            onClick={() => setMode("music")}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all text-left"
          >
            <div className="h-11 w-11 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors flex-shrink-0">
              <Headphones className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-semibold">Music Only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Focused music player, no distractions
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModeChooser
