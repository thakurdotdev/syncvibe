import { create } from "zustand"
import { toast } from "sonner"

export const useGroupInviteStore = create((set, get) => ({
  pendingInvite: null,
  isInviteSheetOpen: false,

  acceptInvite: (socket, user, invite, navigate) => {
    if (!socket || !user) return
    socket.emit("accept-group-invite", {
      groupId: invite.groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
      inviterId: invite.inviterId,
    })
    set({ pendingInvite: null })
    navigate("/music/sync")
  },

  declineInvite: (socket, invite) => {
    if (!socket) return
    socket.emit("decline-group-invite", {
      groupId: invite.groupId,
      inviterId: invite.inviterId,
    })
    set({ pendingInvite: null })
  },

  sendInvite: (socket, user, currentGroup, inviteeUserId) => {
    if (!socket || !currentGroup || !user) return
    socket.emit("send-group-invite", {
      groupId: currentGroup.id,
      inviteeUserId,
      inviterName: user.name,
      inviterPic: user.profilepic,
    })
  },

  reset: () => {
    set({ pendingInvite: null, isInviteSheetOpen: false })
  },
}))
