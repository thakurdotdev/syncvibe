import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Context } from "./Context";

const getMediaConstraints = (facingMode) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const networkQuality = navigator.connection?.effectiveType || "4g";

  const getQualitySettings = () => {
    const baseSettings = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    };

    switch (networkQuality) {
      case "slow-2g":
      case "2g":
        return {
          width: { min: 320, ideal: 320, max: 480 },
          height: { min: 240, ideal: 240, max: 360 },
          frameRate: { min: 8, ideal: 10, max: 15 },
        };
      case "3g":
        return {
          width: { min: 480, ideal: 640, max: 720 },
          height: { min: 360, ideal: 480, max: 540 },
          frameRate: { min: 12, ideal: 15, max: 20 },
        };
      default:
        return isMobile
          ? {
              width: { min: 320, ideal: 640, max: 1280 },
              height: { min: 240, ideal: 480, max: 720 },
              frameRate: { min: 15, ideal: 24, max: 30 },
            }
          : baseSettings;
    }
  };

  return {
    video: {
      ...getQualitySettings(),
      facingMode: facingMode || "user",
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1,
    },
  };
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:443",
        "turn:global.relay.metered.ca:443?transport=tcp",
      ],
      username: import.meta.env.VITE_IC_USERNAME,
      credential: import.meta.env.VITE_IC_CREDENTIAL,
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  sdpSemantics: "unified-plan",
};

const RECONNECTION_DELAY = 2000;
const MAX_RECONNECTION_ATTEMPTS = 5;

export const ChatContext = createContext();

export const useSocket = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { user } = useContext(Context);
  const navigate = useNavigate();

  const [connectionState, setConnectionState] = useState("new");
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const connectionCheckInterval = useRef(null);

  const [users, setUsers] = useState([]);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remotePeerIdRef = useRef(null);

  const [connectionQuality, setConnectionQuality] = useState("good");
  const connectionTimeout = useRef(null);
  const statsInterval = useRef(null);

  const monitorConnectionQuality = useCallback((pc) => {
    if (!pc) return;

    const checkStats = async () => {
      try {
        const stats = await pc.getStats();
        let totalPacketsLost = 0;
        let totalPackets = 0;

        stats.forEach((stat) => {
          if (stat.type === "inbound-rtp") {
            totalPacketsLost += stat.packetsLost || 0;
            totalPackets += stat.packetsReceived || 0;
          }
        });

        const lossRate = totalPackets > 0 ? totalPacketsLost / totalPackets : 0;

        if (lossRate > 0.1) {
          setConnectionQuality("poor");
          adjustMediaQuality(pc, "low");
        } else if (lossRate > 0.05) {
          setConnectionQuality("fair");
          adjustMediaQuality(pc, "medium");
        } else {
          setConnectionQuality("good");
        }
      } catch (error) {
        console.warn("Error monitoring connection quality:", error);
      }
    };

    statsInterval.current = setInterval(checkStats, 5000);
    return () => clearInterval(statsInterval.current);
  }, []);

  const adjustMediaQuality = async (pc, quality) => {
    if (!pc) return;

    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    try {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];

      switch (quality) {
        case "low":
          params.encodings[0].maxBitrate = 150000;
          params.encodings[0].maxFramerate = 15;
          break;
        case "medium":
          params.encodings[0].maxBitrate = 500000;
          params.encodings[0].maxFramerate = 20;
          break;
        case "high":
          params.encodings[0].maxBitrate = 2500000;
          params.encodings[0].maxFramerate = 30;
          break;
      }

      await sender.setParameters(params);
    } catch (error) {
      console.warn("Failed to adjust media quality:", error);
    }
  };

  const restartIceConnection = async () => {
    if (!peerConnection.current) return;

    try {
      const offer = await peerConnection.current.createOffer({
        iceRestart: true,
      });
      await peerConnection.current.setLocalDescription(offer);

      socket?.emit("call-user", {
        offer,
        to: remotePeerIdRef.current,
        from: user.userid,
        name: user.name,
        profilepic: user?.profilepic,
        isRestart: true,
      });
    } catch (error) {
      console.error("Error restarting ICE connection:", error);
    }
  };

  const handleConnectionFailure = () => {
    if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      setTimeout(() => {
        console.log(
          `Attempting reconnection... Attempt ${reconnectionAttempts + 1}`,
        );
        restartIceConnection();
        setReconnectionAttempts((prev) => prev + 1);
      }, RECONNECTION_DELAY);
    } else {
      console.log("Max reconnection attempts reached");
      endCall();
    }
  };

  const cleanupMediaStreams = useCallback(() => {
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }

    remotePeerIdRef.current = null;
    setIsInCall(false);
    setIncomingCall(null);
    setCurrentCall(null);
    setReconnectionAttempts(0);
    setConnectionState("new");
  }, []);

  const initializePeerConnection = useCallback(
    (remotePeerId) => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }

      const peer = new RTCPeerConnection(ICE_SERVERS);
      remotePeerIdRef.current = remotePeerId;

      peer.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);

        if (event.streams && event.streams[0]) {
          clearTimeout(connectionTimeout.current);
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);

          // Monitor track status
          event.track.onmute = () =>
            console.log("Remote track muted:", event.track.kind);
          event.track.onunmute = () =>
            console.log("Remote track unmuted:", event.track.kind);
          event.track.onended = () => {
            console.log("Remote track ended:", event.track.kind);
            peer.getTransceivers().forEach((transceiver) => {
              if (transceiver.receiver.track.kind === event.track.kind) {
                transceiver.direction = "recvonly";
              }
            });
          };
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("ice-candidate", {
            candidate: event.candidate,
            to: remotePeerIdRef.current,
          });
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peer.iceConnectionState);

        if (peer.iceConnectionState === "failed") {
          restartIceConnection();
        } else if (peer.iceConnectionState === "disconnected") {
          setTimeout(() => {
            if (peer.iceConnectionState === "disconnected") {
              restartIceConnection();
            }
          }, 2000);
        }
      };

      peer.onconnectionstatechange = () => {
        console.log("Connection State:", peer.connectionState);
        setConnectionState(peer.connectionState);

        if (peer.connectionState === "connected") {
          monitorConnectionQuality(peer);
        } else if (peer.connectionState === "failed") {
          handleConnectionFailure();
        }
      };

      peerConnection.current = peer;
      return peer;
    },
    [socket, user, monitorConnectionQuality],
  );

  const startCall = useCallback(
    async (recipientId) => {
      try {
        cleanupMediaStreams();

        const constraints = getMediaConstraints(facingMode);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Verify stream has both audio and video tracks
        if (
          !stream.getVideoTracks().length ||
          !stream.getAudioTracks().length
        ) {
          throw new Error("Failed to get complete media stream");
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        const peer = initializePeerConnection(recipientId);

        // Add tracks one by one and verify
        stream.getTracks().forEach((track) => {
          const sender = peer.addTrack(track, stream);
          if (!sender) {
            console.warn(
              `Failed to add ${track.kind} track to peer connection`,
            );
          }
        });

        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        await peer.setLocalDescription(new RTCSessionDescription(offer));

        socket?.emit("call-user", {
          offer,
          to: recipientId,
          from: user.userid,
          name: user.name,
          profilepic: user?.profilepic,
        });

        setIsInCall(true);
        setCurrentCall({ userid: recipientId });
      } catch (error) {
        console.error("Error starting call:", error);
        cleanupMediaStreams();
      }
    },
    [socket, user, initializePeerConnection, cleanupMediaStreams],
  );

  const answerCall = useCallback(async () => {
    try {
      cleanupMediaStreams();

      const constraints = getMediaConstraints(facingMode);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStreamRef.current = stream;
      setLocalStream(stream);

      const peer = initializePeerConnection(incomingCall.from); // Pass caller ID

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      await peer.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer),
      );

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(new RTCSessionDescription(answer));

      socket?.emit("call-accepted", {
        answer,
        to: incomingCall.from,
        name: user.name,
        profilepic: user?.profilepic,
      });

      setIsInCall(true);
      setCurrentCall({
        userid: incomingCall.from,
        name: incomingCall.name,
        profilepic: incomingCall.profilepic,
      });
      setIncomingCall(null);
    } catch (error) {
      console.error("Error answering call:", error);
      cleanupMediaStreams();
    }
  }, [
    socket,
    incomingCall,
    user,
    initializePeerConnection,
    cleanupMediaStreams,
  ]);

  const rejectCall = useCallback(() => {
    if (socket?.connected && incomingCall?.from) {
      socket.emit("call-rejected", {
        to: incomingCall.from,
      });
    }
    setIncomingCall(null);
  }, [socket, incomingCall]);

  const endCall = useCallback(() => {
    if (socket?.connected && remotePeerIdRef.current) {
      socket.emit("end-call", {
        to: remotePeerIdRef.current, // Use stored remote peer ID
      });
    }
    cleanupMediaStreams();
  }, [socket, cleanupMediaStreams]);

  const getAllExistingChats = useCallback(async () => {
    if (!user?.userid) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/get/chatlist`,
        { withCredentials: true },
      );

      if (response.status === 200) {
        const updatedChatList = response.data.chatList.map((chat) => ({
          ...chat,
          isTyping: false,
        }));
        setUsers(updatedChatList);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.userid]);

  const updateCurrentChatStatus = useCallback((userId, isOnline) => {
    setCurrentChat((prevChat) => {
      if (prevChat?.otherUser?.userid === userId) {
        return { ...prevChat, isOnline };
      }
      return prevChat;
    });
  }, []);

  const showNotification = (message) => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
      const notification = new Notification(
        `${message?.senderName} sent you a message`,
        {
          body: message?.content ? message.content : "Sent an attachment",
          icon: "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp",
        },
      );

      notification.onclick = () => {
        window.focus();
        navigate("/chat", { state: { chatData: message } });
      };
    }
  };

  const handleMessageReceived = useCallback(
    (messageData) => {
      const { senderid } = messageData;

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.otherUser.userid === senderid
            ? { ...user, lastmessage: messageData.content }
            : user,
        ),
      );

      showNotification(messageData);
    },
    [users],
  );

  const setupSocket = useCallback(() => {
    if (!user?.userid || socket?.connected) return;

    const newSocket = io(import.meta.env.VITE_API_URL, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    const typingTimeouts = {};

    // Socket event handlers
    const handleConnect = () => {
      newSocket.emit("setup", { userid: user.userid, name: user.name });
      newSocket.emit("user_online", user.userid);
      newSocket.emit("get_initial_online_users");
    };

    const handleTypingStatus = ({ userId, isTyping }) => {
      if (typingTimeouts[userId]) {
        clearTimeout(typingTimeouts[userId]);
      }

      const updateTypingStatus = (status) => {
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.otherUser.userid === userId
              ? { ...user, isTyping: status }
              : user,
          ),
        );
        setCurrentChat((prevChat) =>
          prevChat && prevChat?.otherUser?.userid === userId
            ? { ...prevChat, isTyping: status }
            : prevChat,
        );
      };

      updateTypingStatus(isTyping);

      if (isTyping) {
        typingTimeouts[userId] = setTimeout(
          () => updateTypingStatus(false),
          3000,
        );
      }
    };

    const handleIncomingCall = async ({ from, name, profilepic, offer }) => {
      setIncomingCall({ from, name, profilepic, offer });
    };

    const handleCallAccepted = async ({ answer, from, name, profilepic }) => {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.signalingState === "have-local-offer"
        ) {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
          setCurrentCall({ userid: from, name, profilepic });
        }
      } catch (error) {
        console.error("Error handling call acceptance:", error);
        endCall();
      }
    };

    // Attach event listeners
    newSocket.on("connect", handleConnect);
    newSocket.on("typing_status", handleTypingStatus);
    newSocket.on("user_online", (userId) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: true }));
      updateCurrentChatStatus(userId, true);
    });
    newSocket.on("user_offline", (userId) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: false }));
      updateCurrentChatStatus(userId, false);
    });
    newSocket.on("initial_online_users", (onlineUserIds) => {
      setOnlineStatuses(
        onlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      );
    });

    const handleCallEnded = () => {
      console.log("Call ended by remote peer");
      cleanupMediaStreams();
    };

    newSocket.on("call-ended", handleCallEnded);

    // Enhanced ice candidate handling
    newSocket.on("ice-candidate", async ({ candidate }) => {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.remoteDescription
        ) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        }
      } catch (error) {
        console.error("Error adding ice candidate:", error);
      }
    });

    newSocket.on("call-rejected", () => {
      setCurrentCall(null);
      setIncomingCall(null);
      cleanupMediaStreams();
    });

    if ("Notification" in window) {
      if (
        Notification.permission !== "granted" &&
        Notification.permission !== "denied"
      ) {
        Notification.requestPermission();
      }
    }

    newSocket.on("message-received", handleMessageReceived);
    newSocket.on("incoming-call", handleIncomingCall);
    newSocket.on("call-accepted", handleCallAccepted);

    setSocket(newSocket);

    return () => {
      Object.values(typingTimeouts).forEach(clearTimeout);
      cleanupMediaStreams();
      newSocket.disconnect();
    };
  }, [user?.userid, updateCurrentChatStatus, cleanupMediaStreams]);

  const cleanUpSocket = () => {
    cleanupMediaStreams();
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
    }
    setUsers([]);
    setOnlineStatuses({});
    setCurrentChat(null);
    if (socket) {
      socket.emit("user_offline", user.userid);
      socket.off("connect");
      socket.off("typing_status");
      socket.off("user_online");
      socket.off("user_offline");
      socket.off("initial_online_users");
      socket.off("message-received");
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-ended");
      socket.off("call-rejected");
      socket.disconnect();
      setSocket(null);
    }
  };

  useEffect(() => {
    if (user?.userid) {
      getAllExistingChats();
      setupSocket();
    }
  }, [user?.userid, getAllExistingChats, setupSocket]);

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
    isInCall,
    incomingCall,
    currentCall,
    localStream,
    remoteStream,
    startCall,
    answerCall,
    endCall,
    rejectCall,
    connectionState,
    connectionQuality,
    cleanUpSocket,
  };

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
