import React from "react"
import { Copy, Info, MoreHorizontal, Trash } from "lucide-react"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog"

const MessageActions = ({ message, isOwnMessage, handleCopy, deleteMessage, onShowInfo }) => {
  const isMediaOnly = message.fileurl && !message.content?.trim()

  return (
    <div
      className={`absolute ${isOwnMessage ? "-left-12" : "-right-12"} ${
        isMediaOnly ? "top-2" : "top-0"
      } opacity-0 group-hover:opacity-100 transition-opacity`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwnMessage ? "start" : "end"} className="w-[160px]">
          {isOwnMessage && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => onShowInfo && onShowInfo(message)}
            >
              <Info className="mr-2 h-4 w-4" />
              <span>Message Info</span>
            </DropdownMenuItem>
          )}

          {message.content && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => handleCopy(message.content)}
            >
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy</span>
            </DropdownMenuItem>
          )}

          {isOwnMessage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="text-destructive cursor-pointer focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Are you sure you want to delete this message?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMessage(message.messageid)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default MessageActions
