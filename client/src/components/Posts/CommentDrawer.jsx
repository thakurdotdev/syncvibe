import { ChevronDown, ChevronUp, Loader2, Send, X } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/revola"
import { useAddCommentMutation } from "@/hooks/mutations/usePostMutations"
import { useCommentsQuery } from "@/hooks/queries/usePostQueries"
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary"
import { TimeAgo } from "@/Utils/TimeAgo"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"

const Comment = ({ comment, comments, onReply, replyingTo }) => {
  const navigate = useNavigate()
  const [showReplies, setShowReplies] = useState(false)
  const replies = comments.filter((reply) => reply.parentCommentId === comment.id)

  return (
    <div className="py-4 first:pt-0">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={getProfileCloudinaryUrl(comment.user?.profilepic)}
              alt={comment.user?.name}
              title={comment.user?.name}
              className="rounded-full cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                navigate(`/user/${comment?.user?.username}`, {
                  state: {
                    user: {
                      userid: comment?.createdby,
                    },
                  },
                })
              }}
            />
            <AvatarFallback>{comment.user?.name[0]} </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
                {comment.user?.name}
              </span>
              <span className="text-xs text-gray-500">{TimeAgo(comment.createdat)}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {comment.comment}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => onReply(comment.id, comment.user?.name)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Reply
              </button>

              {replies.length > 0 && (
                <div className="mt-1">
                  <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="flex items-center gap-2 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {showReplies ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Hide replies
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        View {replies.length} {replies.length === 1 ? "reply" : "replies"}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            {showReplies && (
              <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={getProfileCloudinaryUrl(reply.user?.profilepic)}
                        alt={reply.user?.name}
                        title={reply.user?.name}
                        className="rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          navigate(`/user/${reply?.user?.username}`, {
                            state: {
                              user: {
                                userid: reply?.createdby,
                              },
                            },
                          })
                        }}
                      />
                      <AvatarFallback>{reply.user?.name[0]} </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
                          {reply.user?.name}
                        </span>
                        <span className="text-xs text-gray-500">{TimeAgo(reply.createdat)}</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                        {reply.comment}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {/* <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                              <Heart className="w-3 h-3 text-gray-500" />
                            </button> */}
                        <button
                          onClick={() => onReply(comment.id, reply.user?.name)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CommentDrawer = ({ postid, isOpen, onClose }) => {
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyingToUsername, setReplyingToUsername] = useState("")

  const { data: commentsData, isLoading: loading } = useCommentsQuery(postid, {
    enabled: isOpen && !!postid,
  })
  const comments = commentsData?.comments ?? []

  const addCommentMutation = useAddCommentMutation()

  const handleCommentSubmit = (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    addCommentMutation.mutate(
      { comment: commentText, postid, parentCommentId: replyingTo },
      {
        onSuccess: () => {
          toast.success(replyingTo ? "Reply Added" : "Comment Added")
          setCommentText("")
          setReplyingTo(null)
          setReplyingToUsername("")
        },
        onError: () => {
          toast.error("Failed to post comment")
        },
      },
    )
  }

  const handleReply = (commentId, username) => {
    setReplyingTo(commentId)
    setReplyingToUsername(username)
    setCommentText(`@${username} `)
    document.getElementById("comment-input").focus()
  }

  const parentComments = comments.filter((comment) => !comment.parentCommentId)

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={onClose}>
      <ResponsiveDialogContent className="max-sm:max-h-[85%] sm:max-h-[90vh] sm:max-w-lg p-0 flex flex-col">
        <ResponsiveDialogHeader className="border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex-shrink-0">
          <ResponsiveDialogTitle className="text-lg font-semibold">Comments</ResponsiveDialogTitle>
          <ResponsiveDialogClose className="absolute right-3 top-3">
            <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </ResponsiveDialogClose>
        </ResponsiveDialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : parentComments.length === 0 ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-500 dark:text-gray-400">No comments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 px-4 mt-3">
              {parentComments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  comments={comments}
                  onReply={handleReply}
                  replyingTo={replyingTo}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 flex-shrink-0">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Replying to <span className="text-blue-500 font-medium">@{replyingToUsername}</span>
              </span>
              <button
                onClick={() => {
                  setReplyingTo(null)
                  setReplyingToUsername("")
                  setCommentText("")
                }}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
              >
                Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
            <Input
              id="comment-input"
              type="text"
              placeholder={replyingTo ? `Reply to ${replyingToUsername}...` : "Add a comment..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="rounded-full"
            />
            <Button
              size="icon"
              variant="ghost"
              type="submit"
              disabled={!commentText.trim()}
              className="p-2.5 rounded-full"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

export default CommentDrawer
