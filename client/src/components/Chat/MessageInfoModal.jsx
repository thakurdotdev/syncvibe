import React from "react"
import { Check, Info } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { formatFullDateTime } from "./ChatDateUtils"

const MessageInfoModal = ({ message, onClose }) => {
  return (
    <AlertDialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Message Info
          </AlertDialogTitle>
        </AlertDialogHeader>

        {message?.content && (
          <div className="p-3 bg-muted/60 rounded-lg text-sm mb-2 text-foreground break-words max-h-28 overflow-y-auto">
            {message.content}
          </div>
        )}

        <div className="space-y-3 my-2">
          <div className="flex items-start gap-3 p-3 bg-card border rounded-lg">
            <div className="flex text-blue-500 mt-0.5">
              <Check size={16} />
              <Check size={16} className="-ml-2.5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Read</div>
              <div className="text-xs text-muted-foreground">
                {message?.isread
                  ? formatFullDateTime(message.readat) || "Read"
                  : "Not read yet"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-card border rounded-lg">
            <Check size={16} className="text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Delivered</div>
              <div className="text-xs text-muted-foreground">
                {formatFullDateTime(message?.createdat)}
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default MessageInfoModal
