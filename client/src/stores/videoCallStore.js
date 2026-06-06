import axios from "axios"
import { create } from "zustand"

const getMediaConstraints = (facingMode) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const networkQuality = navigator.connection?.effectiveType || "4g"

  const getQualitySettings = () => {
    const baseSettings = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    }

    switch (networkQuality) {
      case "slow-2g":
      case "2g":
        return {
          width: { min: 320, ideal: 320, max: 480 },
          height: { min: 240, ideal: 240, max: 360 },
          frameRate: { min: 8, ideal: 10, max: 15 },
        }
      case "3g":
        return {
          width: { min: 480, ideal: 640, max: 720 },
          height: { min: 360, ideal: 480, max: 540 },
          frameRate: { min: 12, ideal: 15, max: 20 },
        }
      default:
        return isMobile
          ? {
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            frameRate: { min: 15, ideal: 24, max: 30 },
          }
          : baseSettings
    }
  }

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
  }
}

const RECONNECTION_DELAY = 2000
const MAX_RECONNECTION_ATTEMPTS = 5

export const useVideoCallStore = create((set, get) => ({
  isInCall: false,
  incomingCall: null,
  currentCall: null,
  localStream: null,
  remoteStream: null,
  connectionState: "new",
  connectionQuality: "good",
  callStatus: "idle",
  facingMode: "user",

  _socket: null,
  _user: null,
  _peerConnection: null,
  _localStreamRef: null,
  _remoteStreamRef: null,
  _remotePeerIdRef: null,
  _reconnectionAttempts: 0,
  _statsInterval: null,
  _connectionTimeout: null,
  _iceServers: null,
  _pendingCandidates: [],

  setSocket: (socket) => set({ _socket: socket }),
  setUser: (user) => set({ _user: user }),

  fetchIceServers: async () => {
    const cached = get()._iceServers
    if (cached) return cached

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/turn/credentials`,
        { withCredentials: true }
      )
      const config = {
        ...response.data,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all",
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      }
      set({ _iceServers: config })
      return config
    } catch (error) {
      console.error("Failed to fetch ICE servers:", error)
      const fallback = {
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all",
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      }
      set({ _iceServers: fallback })
      return fallback
    }
  },

  _stopTracks: (stream) => {
    if (!stream) return
    stream.getTracks().forEach((track) => {
      track.stop()
      stream.removeTrack(track)
    })
  },

  _closePeerConnection: () => {
    const { _peerConnection: pc, _statsInterval, _connectionTimeout } = get()

    if (_statsInterval) clearInterval(_statsInterval)
    if (_connectionTimeout) clearTimeout(_connectionTimeout)

    if (pc) {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.oniceconnectionstatechange = null
      pc.onconnectionstatechange = null
      pc.onnegotiationneeded = null
      try {
        pc.close()
      } catch {}
    }

    set({
      _peerConnection: null,
      _statsInterval: null,
      _connectionTimeout: null,
      _pendingCandidates: [],
    })
  },

  cleanupMediaStreams: () => {
    const state = get()
    state._closePeerConnection()
    state._stopTracks(state._localStreamRef)
    state._stopTracks(state._remoteStreamRef)

    set({
      localStream: null,
      remoteStream: null,
      isInCall: false,
      incomingCall: null,
      currentCall: null,
      connectionState: "new",
      connectionQuality: "good",
      callStatus: "idle",
      _localStreamRef: null,
      _remoteStreamRef: null,
      _remotePeerIdRef: null,
      _reconnectionAttempts: 0,
    })
  },

  _adjustMediaQuality: async (pc, quality) => {
    if (!pc) return

    const sender = pc.getSenders().find((s) => s.track?.kind === "video")
    if (!sender) return

    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]

      const presets = {
        low: { maxBitrate: 150000, maxFramerate: 15 },
        medium: { maxBitrate: 500000, maxFramerate: 20 },
        high: { maxBitrate: 2500000, maxFramerate: 30 },
      }

      const preset = presets[quality]
      if (!preset) return

      Object.assign(params.encodings[0], preset)
      await sender.setParameters(params)
    } catch (error) {
      console.warn("Failed to adjust media quality:", error)
    }
  },

  _monitorConnectionQuality: (pc) => {
    if (!pc) return

    const { _statsInterval: existing } = get()
    if (existing) clearInterval(existing)

    let prevPacketsLost = 0
    let prevPacketsReceived = 0

    const checkStats = async () => {
      try {
        if (pc.connectionState !== "connected") return

        const stats = await pc.getStats()
        let currentLost = 0
        let currentReceived = 0

        stats.forEach((stat) => {
          if (stat.type === "inbound-rtp" && stat.kind === "video") {
            currentLost += stat.packetsLost || 0
            currentReceived += stat.packetsReceived || 0
          }
        })

        const deltaLost = currentLost - prevPacketsLost
        const deltaReceived = currentReceived - prevPacketsReceived
        prevPacketsLost = currentLost
        prevPacketsReceived = currentReceived

        if (deltaReceived <= 0) return

        const lossRate = deltaLost / (deltaLost + deltaReceived)

        if (lossRate > 0.1) {
          set({ connectionQuality: "poor" })
          get()._adjustMediaQuality(pc, "low")
        } else if (lossRate > 0.05) {
          set({ connectionQuality: "fair" })
          get()._adjustMediaQuality(pc, "medium")
        } else {
          const current = get().connectionQuality
          if (current !== "good") {
            set({ connectionQuality: "good" })
            get()._adjustMediaQuality(pc, "high")
          }
        }
      } catch (error) {
        console.warn("Error monitoring connection quality:", error)
      }
    }

    const interval = setInterval(checkStats, 5000)
    set({ _statsInterval: interval })
  },

  _flushPendingCandidates: async () => {
    const { _peerConnection: pc, _pendingCandidates: candidates } = get()
    if (!pc || !pc.remoteDescription || !candidates.length) return

    const toFlush = [...candidates]
    set({ _pendingCandidates: [] })

    for (const candidate of toFlush) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn("Failed to add buffered ICE candidate:", error)
      }
    }
  },

  _restartIceConnection: async () => {
    const { _peerConnection: pc, _socket: socket } = get()
    if (!pc || !socket?.connected) return

    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      socket.emit("ice-restart", { offer })
    } catch (error) {
      console.error("Error restarting ICE connection:", error)
    }
  },

  _handleConnectionFailure: () => {
    const attempts = get()._reconnectionAttempts
    if (attempts < MAX_RECONNECTION_ATTEMPTS) {
      const delay = RECONNECTION_DELAY * Math.pow(1.5, attempts)
      set({ connectionState: "reconnecting", _reconnectionAttempts: attempts + 1 })

      setTimeout(() => {
        if (get().isInCall) {
          get()._restartIceConnection()
        }
      }, delay)
    } else {
      get().endCall()
    }
  },

  _initializePeerConnection: (remotePeerId, iceConfig) => {
    get()._closePeerConnection()

    const peer = new RTCPeerConnection(iceConfig)

    set({
      _remotePeerIdRef: remotePeerId,
      _peerConnection: peer,
      _pendingCandidates: [],
    })

    peer.ontrack = (event) => {
      if (!event.streams?.[0]) return

      const { _connectionTimeout } = get()
      if (_connectionTimeout) clearTimeout(_connectionTimeout)

      set({
        remoteStream: event.streams[0],
        _remoteStreamRef: event.streams[0],
      })

      event.track.onended = () => {
        peer.getTransceivers().forEach((transceiver) => {
          if (transceiver.receiver.track.kind === event.track.kind) {
            transceiver.direction = "recvonly"
          }
        })
      }
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) return
      const { _socket: socket } = get()
      socket?.emit("ice-candidate", {
        candidate: event.candidate,
      })
    }

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState

      if (state === "failed") {
        get()._restartIceConnection()
      } else if (state === "disconnected") {
        const timeout = setTimeout(() => {
          if (peer.iceConnectionState === "disconnected") {
            get()._restartIceConnection()
          }
        }, 3000)
        set({ _connectionTimeout: timeout })
      } else if (state === "connected") {
        set({ _reconnectionAttempts: 0 })
      }
    }

    peer.onconnectionstatechange = () => {
      set({ connectionState: peer.connectionState })

      if (peer.connectionState === "connected") {
        set({ callStatus: "connected", _reconnectionAttempts: 0 })
        get()._monitorConnectionQuality(peer)
      } else if (peer.connectionState === "failed") {
        get()._handleConnectionFailure()
      }
    }

    return peer
  },

  startCall: async (recipientId) => {
    const { isInCall, _socket: socket, _user: user } = get()

    if (isInCall) return
    if (!socket?.connected || !user?.userid) return

    try {
      set({ callStatus: "requesting_media" })

      const iceConfig = await get().fetchIceServers()
      const constraints = getMediaConstraints(get().facingMode)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
        get()._stopTracks(stream)
        throw new Error("Failed to get complete media stream")
      }

      set({ localStream: stream, _localStreamRef: stream, callStatus: "ringing" })

      const peer = get()._initializePeerConnection(recipientId, iceConfig)

      stream.getTracks().forEach((track) => peer.addTrack(track, stream))

      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      await peer.setLocalDescription(new RTCSessionDescription(offer))

      socket.emit("call-user", {
        offer,
        to: recipientId,
        from: user.userid,
        name: user.name,
        profilepic: user?.profilepic,
      })

      set({ isInCall: true, currentCall: { userid: recipientId } })
    } catch (error) {
      console.error("Error starting call:", error)
      get().cleanupMediaStreams()
    }
  },

  answerCall: async () => {
    const state = get()
    const { incomingCall, _socket: socket, _user: user } = state

    if (!incomingCall || !socket?.connected || !user?.userid) return
    if (state.isInCall) return

    const savedCall = { ...incomingCall }
    set({ incomingCall: null, callStatus: "requesting_media" })

    try {
      get()._closePeerConnection()
      get()._stopTracks(get()._localStreamRef)

      const iceConfig = await get().fetchIceServers()
      const constraints = getMediaConstraints(get().facingMode)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      set({
        localStream: stream,
        _localStreamRef: stream,
        callStatus: "connecting",
      })

      const peer = get()._initializePeerConnection(savedCall.from, iceConfig)

      stream.getTracks().forEach((track) => peer.addTrack(track, stream))

      await peer.setRemoteDescription(new RTCSessionDescription(savedCall.offer))

      await get()._flushPendingCandidates()

      const answer = await peer.createAnswer()
      await peer.setLocalDescription(new RTCSessionDescription(answer))

      socket.emit("call-accepted", {
        answer,
        to: savedCall.from,
        name: user.name,
        profilepic: user?.profilepic,
      })

      set({
        isInCall: true,
        currentCall: {
          userid: savedCall.from,
          name: savedCall.name,
          profilepic: savedCall.profilepic,
        },
      })
    } catch (error) {
      console.error("Error answering call:", error)
      get().cleanupMediaStreams()
    }
  },

  rejectCall: () => {
    const { _socket: socket, incomingCall } = get()
    if (socket?.connected && incomingCall?.from) {
      socket.emit("call-rejected", { to: incomingCall.from })
    }
    set({ incomingCall: null })
  },

  endCall: () => {
    const { _socket: socket, isInCall } = get()
    if (socket?.connected && isInCall) {
      socket.emit("end-call")
    }
    get().cleanupMediaStreams()
  },

  setupCallSocketListeners: (socket) => {
    if (!socket) return

    socket.on("incoming-call", ({ from, name, profilepic, offer }) => {
      if (get().isInCall) {
        socket.emit("call-rejected", { to: from, reason: "busy" })
        return
      }
      set({ incomingCall: { from, name, profilepic, offer } })
    })

    socket.on("call-accepted", async ({ answer, from, name, profilepic }) => {
      try {
        const { _peerConnection: pc } = get()
        if (!pc || pc.signalingState !== "have-local-offer") return

        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        set({
          currentCall: { userid: from, name, profilepic },
          callStatus: "connecting",
        })

        await get()._flushPendingCandidates()
      } catch (error) {
        console.error("Error handling call acceptance:", error)
        get().endCall()
      }
    })

    socket.on("ice-candidate", async ({ candidate }) => {
      if (!candidate) return

      const { _peerConnection: pc } = get()
      if (!pc) return

      if (!pc.remoteDescription) {
        set((state) => ({
          _pendingCandidates: [...state._pendingCandidates, candidate],
        }))
        return
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn("Error adding ice candidate:", error)
      }
    })

    socket.on("ice-restart", async ({ offer }) => {
      try {
        const { _peerConnection: pc, _socket: sock } = get()
        if (!pc || !sock?.connected) return

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sock.emit("ice-restart-accept", { answer })
      } catch (error) {
        console.error("Error handling ICE restart:", error)
      }
    })

    socket.on("ice-restart-accept", async ({ answer }) => {
      try {
        const { _peerConnection: pc } = get()
        if (!pc) return
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (error) {
        console.error("Error handling ICE restart accept:", error)
      }
    })

    socket.on("call-ended", () => {
      get().cleanupMediaStreams()
    })

    socket.on("call-rejected", ({ reason } = {}) => {
      set({ callStatus: reason === "busy" ? "busy" : "rejected" })
      setTimeout(() => get().cleanupMediaStreams(), reason === "busy" ? 0 : 1500)
    })

    socket.on("call-error", ({ message, code }) => {
      console.error(`Call error [${code}]:`, message)
      const state = get()

      if (["USER_OFFLINE", "USER_BUSY", "ALREADY_IN_CALL", "CALL_TIMEOUT"].includes(code)) {
        set({ callStatus: code === "CALL_TIMEOUT" ? "timeout" : code.toLowerCase() })
        setTimeout(() => get().cleanupMediaStreams(), 2000)
      }
    })
  },

  removeCallSocketListeners: (socket) => {
    if (!socket) return
    socket.off("incoming-call")
    socket.off("call-accepted")
    socket.off("ice-candidate")
    socket.off("ice-restart")
    socket.off("ice-restart-accept")
    socket.off("call-ended")
    socket.off("call-rejected")
    socket.off("call-error")
  },
}))
