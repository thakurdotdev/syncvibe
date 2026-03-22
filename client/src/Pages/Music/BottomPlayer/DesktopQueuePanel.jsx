import { ListMusic } from "lucide-react"
import { memo } from "react"
import { Badge } from "@/components/ui/badge"
import { usePlayerStore } from "@/stores/playerStore"
import QueueTab from "./QueueTab"

const DesktopQueuePanel = memo(({ ready }) => {
  const playlistLength = usePlayerStore((s) => s.playlist.length)

  return (
    <>
      <div className="dqp-panel">
        <div className="dqp-header">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-4 h-4 text-white/50" />
            <span className="text-sm font-semibold text-white/85 tracking-wide">Queue</span>
            <Badge
              variant="secondary"
              className="h-[18px] text-[10px] px-1.5 bg-white/8 text-white/50 border-0 font-medium"
            >
              {playlistLength}
            </Badge>
          </div>
        </div>

        <div className="dqp-list">
          {ready ? (
            <QueueTab variant="desktop" />
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dqp-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 300px;
          background: transparent;
          // border-left: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          z-index: 25;
        }
        .dqp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 12px 18px;
          flex-shrink: 0;
        }
        .dqp-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .dqp-list::-webkit-scrollbar {
          width: 4px;
        }
        .dqp-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .dqp-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .dqp-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }
        .dqp-item {
          opacity: 0.75;
          transition: opacity 0.2s ease, background 0.2s ease;
        }
        .dqp-item:hover {
          opacity: 1;
          background: rgba(255,255,255,0.04);
        }
        .dqp-item-active {
          background: rgba(255,255,255,0.06);
          opacity: 1;
        }
        .dqp-eq-bar {
          width: 2px;
          border-radius: 1px;
          background: rgba(255,255,255,0.7);
        }
        .dqp-eq-1 { animation: dqpEq1 1s ease-in-out infinite; }
        .dqp-eq-2 { animation: dqpEq2 1s ease-in-out infinite 0.15s; }
        .dqp-eq-3 { animation: dqpEq3 1s ease-in-out infinite 0.3s; }
        @keyframes dqpEq1 { 0%,100%{height:10px} 50%{height:16px} }
        @keyframes dqpEq2 { 0%,100%{height:14px} 50%{height:8px} }
        @keyframes dqpEq3 { 0%,100%{height:8px} 50%{height:14px} }
      `}</style>
    </>
  )
})

DesktopQueuePanel.displayName = "DesktopQueuePanel"
export default DesktopQueuePanel
