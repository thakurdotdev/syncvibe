import ImageGallery from "@/components/ImageGallery"
import SwipeableModal from "@/components/SwipeableModal"
import { Message, useChat } from "@/context/SocketContext"
import { useUser } from "@/context/UserContext"
import { useTheme } from "@/context/ThemeContext"
import { uploadToCloudinary } from "@/utils/Cloudinary"
import useApi from "@/utils/hooks/useApi"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import MessageHeader from "@/components/chat/MessageHeader"
import MessageBubble from "@/components/chat/MessageBubble"
import ChatInput from "@/components/chat/ChatInput"
import DateBubble from "@/components/chat/DateBubble"

const formatFullDateTime = (dateString?: string | null) => {
  if (!dateString) return ""
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return "Today"
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    })
  }
}

const ChatWithUser = () => {
  const api = useApi()
  const { user } = useUser()
  const { colors } = useTheme()
  const loggedInUserId = user?.userid
  const { currentChat, setCurrentChat, socket, onlineStatuses } = useChat()

  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<ImagePicker.ImagePickerSuccessResult | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showMessageOptions, setShowMessageOptions] = useState(false)
  const [showMessageInfo, setShowMessageInfo] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState("")
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0)

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (Platform.OS !== "android") return

    const showSub = Keyboard.addListener("keyboardDidShow", (e: KeyboardEvent) => {
      setAndroidKeyboardHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!currentChat?.chatid) return

    try {
      setLoading(true)
      const response = await api.get(`/api/get/messages/${currentChat.chatid}`)
      if (response.status === 200) {
        setMessages(response.data.chats)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setLoading(false)
    }
  }, [currentChat?.chatid, api])

  const markAsRead = useCallback(
    (messageIds: number[]) => {
      if (!currentChat?.chatid || !currentChat?.otherUser?.userid || !messageIds.length) return
      if (!socket?.connected) return

      socket.emit("messages-read", {
        messageIds,
        chatid: currentChat.chatid,
        readerId: loggedInUserId,
        senderId: currentChat.otherUser.userid,
      })

      // Optimistic local update
      const now = new Date().toISOString()
      const idSet = new Set(messageIds)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid && idSet.has(Number(msg.messageid)) ? { ...msg, isread: true, readat: now } : msg,
        ),
      )
    },
    [currentChat?.chatid, currentChat?.otherUser?.userid, socket, loggedInUserId],
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const outboxQueueRef = useRef<Map<number, { tempId: number; payload: any }>>(new Map())
  const ackTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const clearAckTimer = useCallback((tempId: number) => {
    const timer = ackTimersRef.current.get(tempId)
    if (timer) {
      clearTimeout(timer)
      ackTimersRef.current.delete(tempId)
    }
    outboxQueueRef.current.delete(tempId)
  }, [])

  const sendQueuedMessage = useCallback(
    (payload: any) => {
      const { tempId } = payload
      outboxQueueRef.current.set(tempId, { tempId, payload })

      // 10s ACK timeout
      const timer = setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === tempId || msg.tempId === tempId
              ? { ...msg, status: "failed" }
              : msg,
          ),
        )
        ackTimersRef.current.delete(tempId)
      }, 10000)

      ackTimersRef.current.set(tempId, timer)

      if (socket?.connected) {
        socket.emit("send-message", payload)
      }
    },
    [socket],
  )

  const handleRetryMessage = useCallback(
    (failedMsg: Message) => {
      const tempId = typeof failedMsg.messageid === "number" ? failedMsg.messageid : Date.now()

      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === failedMsg.messageid
            ? { ...msg, status: "pending" }
            : msg,
        ),
      )

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const queuedItem = outboxQueueRef.current.get(tempId)
      if (queuedItem) {
        sendQueuedMessage(queuedItem.payload)
      } else if (currentChat?.chatid && currentChat?.otherUser?.userid) {
        sendQueuedMessage({
          tempId,
          chatid: currentChat.chatid,
          content: failedMsg.content || null,
          fileurl: failedMsg.fileurl || null,
          recipientId: currentChat.otherUser.userid,
          senderName: user?.name,
          participants: currentChat.participants,
        })
      }
    },
    [currentChat, user?.name, sendQueuedMessage],
  )

  // Socket event listeners
  useEffect(() => {
    if (!socket || !currentChat?.chatid) return

    const handleConnect = () => {
      // Re-sync messages and drain outbox queue
      fetchMessages()

      outboxQueueRef.current.forEach(({ payload }) => {
        socket.emit("send-message", payload)
      })
    }

    const handleNewMessage = (newMessageReceived: Message) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prev) => [...prev, newMessageReceived])
      }
    }

    const handleMessageAck = (data: { tempId: number; message: Message }) => {
      clearAckTimer(data.tempId)

      if (data?.message?.chatid === currentChat.chatid) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === data.tempId || msg.tempId === data.tempId
              ? {
                  ...data.message,
                  participants: currentChat.participants,
                  senderName: user?.name,
                  isread: false,
                  status: "sent",
                }
              : msg,
          ),
        )
      }
    }

    const handleMessageError = (data: { tempId: number; error: string }) => {
      clearAckTimer(data.tempId)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === data.tempId || msg.tempId === data.tempId
            ? { ...msg, status: "failed" }
            : msg,
        ),
      )
      console.error("Message send failed:", data.error)
    }

    const handleReadStatus = (data: { messageIds?: number[]; chatid?: number; readat?: string }) => {
      if (data?.chatid === currentChat.chatid && Array.isArray(data.messageIds)) {
        const idSet = new Set(data.messageIds.map(Number))
        const readTime = data.readat || new Date().toISOString()
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid && idSet.has(Number(msg.messageid))
              ? { ...msg, isread: true, readat: readTime, status: "sent" }
              : msg,
          ),
        )
      }
    }

    socket.on("connect", handleConnect)
    socket.on("message-received", handleNewMessage)
    socket.on("message-ack", handleMessageAck)
    socket.on("message-error", handleMessageError)
    socket.on("messages-read-status", handleReadStatus)

    return () => {
      socket.off("connect", handleConnect)
      socket.off("message-received", handleNewMessage)
      socket.off("message-ack", handleMessageAck)
      socket.off("message-error", handleMessageError)
      socket.off("messages-read-status", handleReadStatus)
    }
  }, [socket, currentChat?.chatid, currentChat?.participants, user?.name, fetchMessages, clearAckTimer])

  // Mark incoming unread messages as read
  useEffect(() => {
    if (!socket?.connected || !currentChat?.chatid || !loggedInUserId || !currentChat?.otherUser?.userid) return

    const otherUserId = currentChat.otherUser.userid
    const unreadIncomingMessages = messages.filter(
      (msg) =>
        msg.chatid === currentChat.chatid &&
        String(msg.senderid) === String(otherUserId) &&
        !msg.isread,
    )

    if (unreadIncomingMessages.length > 0) {
      const messageIds = unreadIncomingMessages
        .map((msg) => Number(msg.messageid))
        .filter((id): id is number => !isNaN(id) && id > 0)

      if (messageIds.length > 0) {
        markAsRead(messageIds)
      }
    }
  }, [currentChat?.chatid, currentChat?.otherUser?.userid, loggedInUserId, messages, socket?.connected, markAsRead])

  const handleTyping = useCallback(
    (text: string) => {
      setMessage(text)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (socket && currentChat?.otherUser?.userid) {
        socket.emit("typing", {
          userId: loggedInUserId,
          recipientId: currentChat.otherUser.userid,
          isTyping: true,
        })

        typingTimeoutRef.current = setTimeout(() => {
          if (socket && currentChat?.otherUser?.userid) {
            socket.emit("typing", {
              userId: loggedInUserId,
              recipientId: currentChat.otherUser.userid,
              isTyping: false,
            })
          }
        }, 1500)
      }
    },
    [socket, loggedInUserId, currentChat?.otherUser?.userid],
  )

  const handleSendMessage = async () => {
    if (!message.trim() && !file) return
    if (!currentChat?.chatid || !loggedInUserId) return

    const currentMsgText = message.trim()
    const currentFile = file
    const tempId = Date.now()

    const optimisticMessage: Message = {
      senderid: loggedInUserId,
      content: currentMsgText,
      createdat: new Date().toISOString(),
      messageid: tempId,
      tempId,
      participants: currentChat.participants || [],
      chatid: currentChat.chatid,
      fileurl: filePreview || undefined,
      senderName: user?.name,
      isread: false,
      status: "pending",
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setMessage("")
    setFile(null)
    setFilePreview(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (socket?.connected && currentChat?.otherUser?.userid) {
      socket.emit("typing", {
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: false,
      })
    }

    // Upload file first if present, then send via socket
    let uploadedUrl: string | undefined = undefined
    if (currentFile && currentFile.assets?.[0]) {
      try {
        const fileAsset = currentFile.assets[0]
        uploadedUrl = await uploadToCloudinary(
          api,
          fileAsset.uri,
          fileAsset.fileName || "image.jpg",
          fileAsset.mimeType || "image/jpeg",
          "chat",
        )
      } catch (error) {
        console.error("Error uploading file:", error)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === tempId ? { ...msg, status: "failed" } : msg,
          ),
        )
        return
      }
    }

    // Queue and send message
    sendQueuedMessage({
      tempId,
      chatid: currentChat.chatid,
      content: currentMsgText || null,
      fileurl: uploadedUrl || null,
      recipientId: currentChat.otherUser.userid,
      senderName: user?.name,
      participants: currentChat.participants,
    })
  }

  const handleAttachment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status === "granted") {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          allowsMultipleSelection: false,
        })

        if (!result.canceled && result.assets?.[0]) {
          setFile(result)
          setFilePreview(result.assets[0].uri)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }
    } catch (error) {
      console.error("Error picking image:", error)
    }
  }

  const processedMessages = useCallback(() => {
    const result: any[] = []
    let currentDate = ""

    messages.forEach((msg) => {
      const messageDate = formatDate(msg.createdat)

      if (messageDate !== currentDate) {
        result.push({
          id: `date-${messageDate}`,
          type: "date",
          date: messageDate,
        })
        currentDate = messageDate
      }

      result.push({
        ...msg,
        type: "message",
      })
    })

    // Reverse for inverted FlatList — newest at index 0
    return result.reverse()
  }, [messages])

  const chatImages = messages.filter((msg) => msg.fileurl).map((msg) => msg.fileurl || "")

  const findImageIndex = useCallback(
    (url: string) => chatImages.findIndex((imgUrl) => imgUrl === url),
    [chatImages],
  )

  const handleImagePress = useCallback(
    (imageUrl: string) => {
      const index = findImageIndex(imageUrl)
      if (index !== -1) {
        setSelectedImageIndex(index)
        setShowGallery(true)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    },
    [findImageIndex],
  )

  const handleMessageLongPress = useCallback((msg: Message) => {
    setSelectedMessage(msg)
    setShowMessageOptions(true)
  }, [])

  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditText(selectedMessage.content || "")
      setEditMode(true)
      setShowMessageOptions(false)
    }
  }, [selectedMessage])

  const handleDeleteMessage = useCallback(async () => {
    if (!selectedMessage?.messageid) {
      setShowMessageOptions(false)
      return
    }

    try {
      const response = await api.delete(`/api/message/${selectedMessage.messageid}`)

      if (response.status === 200) {
        setMessages((prev) => prev.filter((msg) => msg.messageid !== selectedMessage.messageid))

        socket?.emit("message-deleted", {
          messageid: selectedMessage.messageid,
          chatid: currentChat?.chatid,
        })

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error("Error deleting message:", error)
    } finally {
      setShowMessageOptions(false)
    }
  }, [selectedMessage, api, socket, currentChat?.chatid])

  const handleSaveEdit = useCallback(async () => {
    if (!selectedMessage?.messageid || !editText.trim()) {
      setEditMode(false)
      return
    }

    try {
      const response = await api.put(`/api/message/${selectedMessage.messageid}`, {
        content: editText,
      })

      if (response.status === 200) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === selectedMessage.messageid
              ? { ...msg, content: editText, edited: true }
              : msg,
          ),
        )

        socket?.emit("message-edited", {
          messageid: selectedMessage.messageid,
          chatid: currentChat?.chatid,
          content: editText,
        })

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error("Error updating message:", error)
    } finally {
      setEditMode(false)
      setEditText("")
    }
  }, [selectedMessage, editText, api, socket, currentChat?.chatid])

  const handleCancelEdit = useCallback(() => {
    setEditMode(false)
    setEditText("")
  }, [])

  const handleCopyText = useCallback(() => {
    if (selectedMessage?.content) {
      setShowMessageOptions(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [selectedMessage])

  const renderItem = useCallback(
    ({ item }: any) => {
      if (item.type === "date") {
        return <DateBubble date={item.date} />
      }

      return (
        <MessageBubble
          message={item}
          isOwn={item.senderid === loggedInUserId}
          onImagePress={handleImagePress}
          onMessageLongPress={handleMessageLongPress}
          onRetry={handleRetryMessage}
        />
      )
    },
    [loggedInUserId, handleImagePress, handleMessageLongPress, handleRetryMessage],
  )

  const keyExtractor = useCallback(
    (item: any) => (item.type === "date" ? item.id : `msg-${item.messageid}`),
    [],
  )

  const isOnline = onlineStatuses[currentChat?.otherUser?.userid || ""]

  const Wrapper = Platform.OS === "ios" ? KeyboardAvoidingView : View
  const wrapperProps =
    Platform.OS === "ios"
      ? {
          style: styles.container,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : {
          style: [styles.container, { paddingBottom: androidKeyboardHeight }],
        }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <Wrapper {...wrapperProps}>
        <MessageHeader
          onBack={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setCurrentChat(null)
            router.back()
          }}
          user={currentChat?.otherUser}
          isOnline={isOnline}
          isTyping={currentChat?.isTyping}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            inverted
            data={processedMessages()}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messageList}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            showsVerticalScrollIndicator={false}
          />
        )}

        <ChatInput
          message={message}
          onChangeText={handleTyping}
          onSend={handleSendMessage}
          onAttach={handleAttachment}
          filePreview={filePreview}
          onRemoveAttachment={() => {
            setFile(null)
            setFilePreview(null)
          }}
          editMode={editMode}
          editText={editText}
          onEditTextChange={setEditText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />

        {showGallery && chatImages.length > 0 && (
          <ImageGallery
            images={chatImages}
            initialIndex={selectedImageIndex}
            onClose={() => setShowGallery(false)}
          />
        )}

        <SwipeableModal
          isVisible={showMessageOptions}
          onClose={() => setShowMessageOptions(false)}
          maxHeight="35%"
        >
          <View style={styles.modalContent}>
            {selectedMessage?.senderid === loggedInUserId && (
              <OptionItem
                icon="information-circle-outline"
                text="Message Info"
                onPress={() => {
                  setShowMessageOptions(false)
                  setShowMessageInfo(true)
                }}
              />
            )}
            <OptionItem icon="pencil" text="Edit" onPress={handleEditMessage} />
            <OptionItem icon="copy-outline" text="Copy" onPress={handleCopyText} />
            <OptionItem
              icon="trash-outline"
              text="Delete"
              onPress={handleDeleteMessage}
              color={colors.destructive}
            />
          </View>
        </SwipeableModal>

        <SwipeableModal
          isVisible={showMessageInfo}
          onClose={() => setShowMessageInfo(false)}
          maxHeight="45%"
        >
          <View style={styles.infoModalContent}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>
              Message Info
            </Text>

            {selectedMessage?.content ? (
              <View style={[styles.infoPreviewBox, { backgroundColor: colors.accent }]}>
                <Text style={[styles.infoPreviewText, { color: colors.foreground }]} numberOfLines={2}>
                  {selectedMessage.content}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoRows}>
              <View style={[styles.infoRow, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.infoRowLeft}>
                  <MaterialCommunityIcons
                    name="check-all"
                    size={22}
                    color={selectedMessage?.isread ? colors.primary : colors.mutedForeground}
                  />
                  <View style={styles.infoTextGroup}>
                    <Text style={[styles.infoLabel, { color: colors.foreground }]}>Read</Text>
                    <Text style={[styles.infoSubtext, { color: colors.mutedForeground }]}>
                      {selectedMessage?.isread
                        ? formatFullDateTime(selectedMessage.readat) || "Read"
                        : "Not read yet"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <MaterialCommunityIcons
                    name="check"
                    size={22}
                    color={colors.mutedForeground}
                  />
                  <View style={styles.infoTextGroup}>
                    <Text style={[styles.infoLabel, { color: colors.foreground }]}>Delivered</Text>
                    <Text style={[styles.infoSubtext, { color: colors.mutedForeground }]}>
                      {formatFullDateTime(selectedMessage?.createdat)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </SwipeableModal>
      </Wrapper>
    </SafeAreaView>
  )
}

const OptionItem = React.memo(
  ({
    icon,
    text,
    onPress,
    color,
  }: {
    icon: any
    text: string
    onPress: () => void
    color?: string
  }) => {
    const { colors } = useTheme()
    const itemColor = color || colors.foreground

    return (
      <Pressable
        style={styles.optionItem}
        onPress={() => {
          onPress()
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
      >
        <Ionicons name={icon} size={22} color={itemColor} />
        <Text style={[styles.optionText, { color: itemColor }]}>{text}</Text>
      </Pressable>
    )
  },
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalContent: {
    padding: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: "500",
  },
  infoModalContent: {
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  infoPreviewBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoPreviewText: {
    fontSize: 14,
    fontWeight: "400",
  },
  infoRows: {
    gap: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  infoTextGroup: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  infoSubtext: {
    fontSize: 13,
  },
})

export default ChatWithUser
