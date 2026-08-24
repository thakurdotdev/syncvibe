import ImageGallery from "@/components/ImageGallery"
import SwipeableModal from "@/components/SwipeableModal"
import { Message, useChat } from "@/context/SocketContext"
import { useUser } from "@/context/UserContext"
import { useTheme } from "@/context/ThemeContext"
import { uploadToCloudinary } from "@/utils/Cloudinary"
import useApi from "@/utils/hooks/useApi"
import { Ionicons } from "@expo/vector-icons"
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
    async (messageIds: number[]) => {
      if (!currentChat?.chatid || !socket || !currentChat?.otherUser?.userid || !messageIds.length) return

      try {
        const response = await api.post(`/api/read/messages`, {
          messageIds,
        })

        if (response.status === 200) {
          socket.emit("messages-read", {
            messageIds,
            chatid: currentChat.chatid,
            readerId: loggedInUserId,
            senderId: currentChat.otherUser.userid,
          })

          const idSet = new Set(messageIds)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageid && idSet.has(msg.messageid) ? { ...msg, isread: true } : msg,
            ),
          )
        }
      } catch (error) {
        console.error("Error marking messages as read:", error)
      }
    },
    [currentChat?.chatid, currentChat?.otherUser?.userid, socket, api, loggedInUserId],
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!socket || !currentChat?.chatid) return

    const handleNewMessage = (newMessageReceived: Message) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prev) => [...prev, newMessageReceived])
      }
    }

    const handleReadStatus = (data: { messageIds?: number[]; chatid?: number }) => {
      if (data?.chatid === currentChat.chatid && Array.isArray(data.messageIds)) {
        const idSet = new Set(data.messageIds)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid && idSet.has(msg.messageid) ? { ...msg, isread: true } : msg,
          ),
        )
      }
    }

    socket.on("message-received", handleNewMessage)
    socket.on("messages-read-status", handleReadStatus)

    return () => {
      socket.off("message-received", handleNewMessage)
      socket.off("messages-read-status", handleReadStatus)
    }
  }, [socket, currentChat?.chatid])

  useEffect(() => {
    if (currentChat?.chatid && loggedInUserId && currentChat?.otherUser?.userid) {
      const otherUserId = currentChat.otherUser.userid
      const unreadIncomingMessages = messages.filter(
        (msg) =>
          msg.chatid === currentChat.chatid &&
          String(msg.senderid) === String(otherUserId) &&
          !msg.isread,
      )

      if (unreadIncomingMessages.length > 0) {
        const messageIds = unreadIncomingMessages
          .map((msg) => msg.messageid)
          .filter((id): id is number => typeof id === "number")

        if (messageIds.length > 0) {
          markAsRead(messageIds)
        }
      }
    }
  }, [currentChat?.chatid, currentChat?.otherUser?.userid, loggedInUserId, messages, markAsRead])

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

    const newMessage: Message = {
      senderid: loggedInUserId,
      content: currentMsgText,
      createdat: new Date().toISOString(),
      messageid: tempId,
      participants: currentChat?.participants || [],
      chatid: currentChat?.chatid,
      fileurl: filePreview || undefined,
      senderName: user?.name,
      isread: false,
    }

    try {
      setMessages((prev) => [...prev, newMessage])
      setMessage("")
      setFile(null)
      setFilePreview(null)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      if (!currentFile) {
        socket?.emit("new-message", newMessage)
      }

      socket?.emit("typing", {
        userId: loggedInUserId,
        recipientId: currentChat?.otherUser.userid,
        isTyping: false,
      })

      let uploadedUrl: string | undefined = undefined
      if (currentFile && currentFile.assets?.[0]) {
        const fileAsset = currentFile.assets[0]
        uploadedUrl = await uploadToCloudinary(
          api,
          fileAsset.uri,
          fileAsset.fileName || "image.jpg",
          fileAsset.mimeType || "image/jpeg",
          "post",
        )
      }

      const response = await api.post("/api/send/message", {
        chatid: currentChat.chatid.toString(),
        senderid: loggedInUserId.toString(),
        content: currentMsgText,
        fileurl: uploadedUrl,
      })

      if (response?.data?.message) {
        const serverMessage: Message = {
          ...response.data.message,
          participants: currentChat.participants,
          senderName: user?.name,
          isread: false,
        }

        setMessages((prev) =>
          prev.map((msg) => (msg.messageid === tempId ? serverMessage : msg)),
        )

        if (currentFile) {
          socket?.emit("new-message", serverMessage)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => prev.filter((msg) => msg.messageid !== tempId))
    }
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
        />
      )
    },
    [loggedInUserId, handleImagePress, handleMessageLongPress],
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
          maxHeight="25%"
        >
          <View style={styles.modalContent}>
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
})

export default ChatWithUser
