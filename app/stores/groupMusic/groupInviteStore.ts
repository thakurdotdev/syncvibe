import { create } from "zustand"
import { Alert } from "react-native"
import { useShallow } from "zustand/react/shallow"

interface InviteData {
  groupId: string
  groupName: string
  inviterName: string
  inviterPic: string
  inviterId: number
}

interface GroupInviteState {
  pendingInvite: InviteData | null
  isInviteSheetOpen: boolean
}

interface GroupInviteActions {
  acceptInvite: (socket: any, user: any, invite: InviteData) => void
  declineInvite: (socket: any, invite: InviteData) => void
  sendInvite: (socket: any, user: any, currentGroup: any, inviteeUserId: number) => void
  reset: () => void
}

type GroupInviteStore = GroupInviteState & GroupInviteActions

const initialState: GroupInviteState = {
  pendingInvite: null,
  isInviteSheetOpen: false,
}

export const useGroupInviteStore = create<GroupInviteStore>()((set) => ({
  ...initialState,

  acceptInvite: (socket, user, invite) => {
    if (!socket || !user) return
    socket.emit("accept-group-invite", {
      groupId: invite.groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
      inviterId: invite.inviterId,
    })
    set({ pendingInvite: null })
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

  reset: () => set({ ...initialState }),
}))

export const useGroupInvite = () =>
  useGroupInviteStore(
    useShallow((s) => ({
      pendingInvite: s.pendingInvite,
      isInviteSheetOpen: s.isInviteSheetOpen,
    })),
  )
