import axios from "axios"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { io } from "socket.io-client"
import { Context } from "./Context"
import { useVideoCallStore } from "../stores/videoCallStore"

export const ChatContext = createContext()

export const useSocket = () => useContext(ChatContext)

export const ChatProvider = ({ children }) => {
  const { user } = useContext(Context)
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [onlineStatuses, setOnlineStatuses] = useState({})
  const [loading, setLoading] = useState(false)
  const [currentChat, setCurrentChat] = useState(null)
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)

  const getAllExistingChats = useCallback(async () => {
    if (!user?.userid) return

    try {
      setLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/get/chatlist`, {
        withCredentials: true,
      })

      if (response.status === 200) {
        const updatedChatList = response.data.chatList.map((chat) => ({
          ...chat,
          isTyping: false,
        }))
        setUsers(updatedChatList)
      }
    } catch (error) {
      console.error("Error fetching chats:", error)
    } finally {
      setLoading(false)
    }
  }, [user?.userid])

  const updateCurrentChatStatus = useCallback((userId, isOnline) => {
    setCurrentChat((prevChat) => {
      if (prevChat?.otherUser?.userid === userId) {
        return { ...prevChat, isOnline }
      }
      return prevChat
    })
  }, [])

  const showNotification = useCallback((message) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return
    if (document.hasFocus()) return

    const notification = new Notification(`${message?.senderName} sent you a message`, {
      body: message?.content ? message.content : "Sent an attachment",
      icon: "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg",
      tag: `msg-${message?.chatid}`,
    })

    notification.onclick = () => {
      window.focus()
      navigate("/chat", { state: { chatData: message } })
      notification.close()
    }
  }, [navigate])

  const handleMessageReceived = useCallback(
    (messageData) => {
      const { senderid } = messageData

      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u?.otherUser?.userid === senderid ? { ...u, lastmessage: messageData.content } : u,
        ),
      )

      showNotification(messageData)
    },
    [showNotification],
  )

  useEffect(() => {
    if (!user?.userid) return

    if (socketRef.current?.connected) return

    const newSocket = io(import.meta.env.VITE_API_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    socketRef.current = newSocket

    const typingTimeouts = {}

    const handleConnect = () => {
      newSocket.emit("setup", { userid: user.userid, name: user.name })
      newSocket.emit("user_online")
      newSocket.emit("get_initial_online_users")
    }

    const handleReconnect = () => {
      handleConnect()
      const videoCallStore = useVideoCallStore.getState()
      videoCallStore.setSocket(newSocket)
    }

    const handleTypingStatus = ({ userId, isTyping }) => {
      if (typingTimeouts[userId]) {
        clearTimeout(typingTimeouts[userId])
      }

      const updateTypingStatus = (status) => {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u?.otherUser?.userid === userId ? { ...u, isTyping: status } : u,
          ),
        )
        setCurrentChat((prevChat) =>
          prevChat && prevChat?.otherUser?.userid === userId
            ? { ...prevChat, isTyping: status }
            : prevChat,
        )
      }

      updateTypingStatus(isTyping)

      if (isTyping) {
        typingTimeouts[userId] = setTimeout(() => updateTypingStatus(false), 3000)
      }
    }

    newSocket.on("connect", handleConnect)
    newSocket.io.on("reconnect", handleReconnect)
    newSocket.on("typing_status", handleTypingStatus)
    newSocket.on("user_online", (userId) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: true }))
      updateCurrentChatStatus(userId, true)
    })
    newSocket.on("user_offline", (userId) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: false }))
      updateCurrentChatStatus(userId, false)
    })
    newSocket.on("initial_online_users", (onlineUserIds) => {
      setOnlineStatuses(onlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}))
    })
    newSocket.on("message-received", handleMessageReceived)
    newSocket.on("call-log", (callMessage) => {
      const CALL_DISPLAY = {
        missed_call: "Missed call",
        completed_call: "Video call",
        rejected_call: "Declined call",
      }
      const displayText = CALL_DISPLAY[callMessage.messagetype] || "Call"
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u?.chatid === callMessage.chatid ? { ...u, lastmessage: displayText } : u,
        ),
      )
    })

    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission()
      }
    }

    const videoCallStore = useVideoCallStore.getState()
    videoCallStore.setSocket(newSocket)
    videoCallStore.setUser(user)
    videoCallStore.setupCallSocketListeners(newSocket)

    setSocket(newSocket)

    return () => {
      Object.values(typingTimeouts).forEach(clearTimeout)
      videoCallStore.removeCallSocketListeners(newSocket)
      videoCallStore.cleanupMediaStreams()
      newSocket.removeAllListeners()
      newSocket.io.removeAllListeners()
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [user?.userid, user?.name, updateCurrentChatStatus, handleMessageReceived, showNotification])

  const cleanUpSocket = useCallback(() => {
    const videoCallStore = useVideoCallStore.getState()
    videoCallStore.removeCallSocketListeners(socketRef.current)
    videoCallStore.cleanupMediaStreams()

    setUsers([])
    setOnlineStatuses({})
    setCurrentChat(null)

    if (socketRef.current) {
      socketRef.current.emit("user_offline")
      socketRef.current.removeAllListeners()
      socketRef.current.io.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [])

  useEffect(() => {
    if (user?.userid) {
      getAllExistingChats()
    }
  }, [user?.userid, getAllExistingChats])

  const contextValue = {
    users,
    setUsers,
    loading,
    setLoading,
    onlineStatuses,
    setOnlineStatuses,
    currentChat,
    setCurrentChat,
    socket,
    getAllExistingChats,
    cleanUpSocket,
  }

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
}
