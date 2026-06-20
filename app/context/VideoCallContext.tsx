import { Camera } from 'expo-camera';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { useChat } from './SocketContext';
import { useUser } from './UserContext';

// Types
interface VideoCallContextType {
  isInCall: boolean;
  incomingCall: IncomingCall | null;
  currentCall: CurrentCall | null;
  localStream: any | null;
  remoteStream: any | null;
  startCall: (recipientId: number, userName: string, profilepic: string) => Promise<void>;
  answerCall: () => Promise<void>;
  endCall: () => void;
  rejectCall: () => void;
  connectionState: string;
  connectionQuality: 'good' | 'fair' | 'poor';
  flipCamera: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  cameraType: 'front' | 'back';
}

interface IncomingCall {
  from: number;
  name: string;
  profilepic?: string;
  offer: RTCSessionDescription;
}

interface CurrentCall {
  userid: number;
  name?: string;
  profilepic?: string;
}

// Constants
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: [
        'turn:global.relay.metered.ca:80',
        'turn:global.relay.metered.ca:443',
        'turn:global.relay.metered.ca:443?transport=tcp',
      ],
      username: 'b7436d44e844cf60ec0e9523',
      credential: 'ymvqMmDUzPGKPvAV',
    },
  ],
  iceCandidatePoolSize: 10,
};

const RECONNECTION_DELAY = 2000;
const MAX_RECONNECTION_ATTEMPTS = 5;
const STATS_INTERVAL = 3000;

// Create context
export const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

// Create hook to use the video call context
export const useVideoCall = (): VideoCallContextType => {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
};

// Provider component
export const VideoCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const { socket } = useChat();

  const [connectionState, setConnectionState] = useState<string>('new');
  const [reconnectionAttempts, setReconnectionAttempts] = useState<number>(0);
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front');
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<any | null>(null);
  const remoteStreamRef = useRef<any | null>(null);
  const remotePeerIdRef = useRef<number | null>(null);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitializing = useRef<boolean>(false);

  // Log function with timestamps
  const logWithTimestamp = (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  };

  // Get appropriate constraints based on network and device
  const getMediaConstraints = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const networkType = networkState.type;
      const isConnected = networkState.isConnected;

      if (!isConnected) {
        throw new Error('No network connection available');
      }

      const defaultConstraints = {
        audio: true,
        video: {
          width: { min: 480, ideal: 720, max: 1280 },
          height: { min: 360, ideal: 540, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 },
          facingMode: cameraType === 'front' ? 'user' : 'environment',
        },
      };

      // Adjust based on network type
      switch (networkType) {
        case Network.NetworkStateType.CELLULAR:
          return {
            audio: true,
            video: {
              width: { min: 320, ideal: 480, max: 640 },
              height: { min: 240, ideal: 360, max: 480 },
              frameRate: { min: 10, ideal: 15, max: 24 },
              facingMode: cameraType === 'front' ? 'user' : 'environment',
            },
          };
        case Network.NetworkStateType.UNKNOWN:
          return {
            audio: true,
            video: {
              width: { min: 320, ideal: 480, max: 640 },
              height: { min: 240, ideal: 360, max: 480 },
              frameRate: { min: 10, ideal: 15, max: 20 },
              facingMode: cameraType === 'front' ? 'user' : 'environment',
            },
          };
        default:
          return defaultConstraints;
      }
    } catch (error) {
      logWithTimestamp('Error getting media constraints:', error);
      // Fallback to basic constraints
      return {
        audio: true,
        video: {
          width: { min: 320, ideal: 480, max: 640 },
          height: { min: 240, ideal: 360, max: 480 },
          frameRate: { min: 10, ideal: 15, max: 24 },
          facingMode: cameraType === 'front' ? 'user' : 'environment',
        },
      };
    }
  }, [cameraType]);

  // Monitor connection quality
  const monitorConnectionQuality = useCallback((pc: RTCPeerConnection) => {
    if (!pc) return;

    const checkStats = async () => {
      try {
        const stats = await pc.getStats();
        let totalPacketsLost = 0;
        let totalPackets = 0;
        let roundTripTime = 0;
        let samplesCount = 0;

        stats.forEach((stat: any) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            totalPacketsLost += stat.packetsLost || 0;
            totalPackets += stat.packetsReceived || 0;
          }
          if (stat.type === 'remote-inbound-rtp') {
            if (stat.roundTripTime) {
              roundTripTime += stat.roundTripTime;
              samplesCount++;
            }
          }
        });

        const lossRate = totalPackets > 0 ? totalPacketsLost / totalPackets : 0;
        const avgRoundTripTime = samplesCount > 0 ? roundTripTime / samplesCount : 0;

        logWithTimestamp(
          `Connection stats - Loss rate: ${(lossRate * 100).toFixed(
            2
          )}%, RTT: ${(avgRoundTripTime * 1000).toFixed(2)}ms`
        );

        // Determine quality based on combined metrics
        if (lossRate > 0.08 || avgRoundTripTime > 0.3) {
          setConnectionQuality('poor');
          adjustMediaQuality(pc, 'low');
        } else if (lossRate > 0.03 || avgRoundTripTime > 0.15) {
          setConnectionQuality('fair');
          adjustMediaQuality(pc, 'medium');
        } else {
          setConnectionQuality('good');
        }
      } catch (error) {
        logWithTimestamp('Error monitoring connection quality:', error);
      }
    };

    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }

    statsInterval.current = setInterval(checkStats, STATS_INTERVAL);
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, []);

  // Adjust media quality based on connection
  const adjustMediaQuality = async (pc: RTCPeerConnection, quality: 'low' | 'medium' | 'high') => {
    if (!pc) return;

    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!sender) return;

    try {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{ active: true }];

      switch (quality) {
        case 'low':
          params.encodings[0].maxBitrate = 150000;
          params.encodings[0].maxFramerate = 15;
          break;
        case 'medium':
          params.encodings[0].maxBitrate = 500000;
          params.encodings[0].maxFramerate = 20;
          break;
        case 'high':
          params.encodings[0].maxBitrate = 1000000;
          params.encodings[0].maxFramerate = 30;
          break;
      }

      await sender.setParameters(params);
      logWithTimestamp(`Adjusted video quality to ${quality}`);
    } catch (error) {
      logWithTimestamp('Failed to adjust media quality:', error);
    }
  };

  // Restart ICE connection
  const restartIceConnection = async () => {
    if (!peerConnection.current || !user || !remotePeerIdRef.current) return;

    try {
      logWithTimestamp('Restarting ICE connection...');

      const offer = await peerConnection.current.createOffer({
        iceRestart: true,
      });

      await peerConnection.current.setLocalDescription(offer);

      socket?.emit('call-user', {
        offer,
        to: remotePeerIdRef.current,
        from: user.userid,
        name: user.name,
        profilepic: user?.profilepic,
        isRestart: true,
      });
    } catch (error) {
      logWithTimestamp('Error restarting ICE connection:', error);
    }
  };

  // Handle connection failure
  const handleConnectionFailure = useCallback(() => {
    if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      logWithTimestamp(
        `Connection failed. Attempting reconnection... Attempt ${
          reconnectionAttempts + 1
        }/${MAX_RECONNECTION_ATTEMPTS}`
      );

      setTimeout(() => {
        restartIceConnection();
        setReconnectionAttempts((prev) => prev + 1);
      }, RECONNECTION_DELAY);
    } else {
      logWithTimestamp('Max reconnection attempts reached. Ending call.');
      endCall();
    }
  }, [reconnectionAttempts]);

  // Clean up media streams
  const cleanupMediaStreams = useCallback(() => {
    logWithTimestamp('Cleaning up media streams and connections');

    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
    }

    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }

    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    if (peerConnection.current) {
      // Remove all event listeners
      peerConnection.current.removeEventListener('track', null);
      peerConnection.current.removeEventListener('icecandidate', null);
      peerConnection.current.removeEventListener('iceconnectionstatechange', null);
      peerConnection.current.removeEventListener('connectionstatechange', null);
      peerConnection.current.removeEventListener('signalingstatechange', null);
      peerConnection.current.close();
      peerConnection.current = null;
    }

    remotePeerIdRef.current = null;
    setIsInCall(false);
    setIncomingCall(null);
    setCurrentCall(null);
    setReconnectionAttempts(0);
    setConnectionState('new');
    setCameraType('front');
    setConnectionQuality('good');
    setIsMuted(false);
    setLocalStream(null);
    setRemoteStream(null);
    isInitializing.current = false;
  }, []);

  // Initialize peer connection
  const initializePeerConnection = useCallback(
    async (remotePeerId: number) => {
      if (isInitializing.current) {
        logWithTimestamp('Peer connection initialization already in progress');
        return null;
      }

      isInitializing.current = true;

      try {
        logWithTimestamp(`Initializing peer connection with remote ID: ${remotePeerId}`);

        if (peerConnection.current) {
          peerConnection.current.close();
        }

        let peer: RTCPeerConnection;
        try {
          peer = new RTCPeerConnection(ICE_SERVERS);
          logWithTimestamp('Peer connection created successfully');
        } catch (err) {
          logWithTimestamp('Error creating RTCPeerConnection instance:', err);
          throw err;
        }

        remotePeerIdRef.current = remotePeerId;

        // Set up event listeners
        peer.addEventListener('track', (event) => {
          logWithTimestamp(`Received remote track: ${event?.track?.kind}`);

          if (event.streams && event.streams[0]) {
            if (connectionTimeout.current) {
              clearTimeout(connectionTimeout.current);
            }
            remoteStreamRef.current = event.streams[0];
            setRemoteStream(event.streams[0]);

            if (!event.track) return;

            // Monitor track status
            event.track.addEventListener('mute', () =>
              logWithTimestamp(`Remote track muted: ${event.track?.kind}`)
            );
            event.track.addEventListener('unmute', () =>
              logWithTimestamp(`Remote track unmuted: ${event.track?.kind}`)
            );
            event.track.addEventListener('ended', () => {
              logWithTimestamp(`Remote track ended: ${event.track?.kind}`);
            });
          }
        });

        peer.addEventListener('icecandidate', (event) => {
          if (event.candidate) {
            socket?.emit('ice-candidate', {
              candidate: event.candidate,
              to: remotePeerIdRef.current,
            });
          }
        });

        peer.addEventListener('iceconnectionstatechange', () => {
          logWithTimestamp(`ICE Connection State: ${peer.iceConnectionState}`);

          if (peer.iceConnectionState === 'failed') {
            logWithTimestamp('ICE connection failed, attempting restart');
            restartIceConnection();
          } else if (peer.iceConnectionState === 'disconnected') {
            logWithTimestamp('ICE connection disconnected, waiting before restart');
            setTimeout(() => {
              if (peer.iceConnectionState === 'disconnected') {
                restartIceConnection();
              }
            }, 2000);
          }
        });

        peer.addEventListener('connectionstatechange', () => {
          logWithTimestamp(`Connection State: ${peer.connectionState}`);
          setConnectionState(peer.connectionState);

          if (peer.connectionState === 'connected') {
            logWithTimestamp('Connection established successfully');
            setReconnectionAttempts(0);
            monitorConnectionQuality(peer);
          } else if (peer.connectionState === 'failed') {
            logWithTimestamp('Connection failed');
            handleConnectionFailure();
          }
        });

        peerConnection.current = peer;
        isInitializing.current = false;
        return peer;
      } catch (error) {
        logWithTimestamp('Error initializing peer connection:', error);
        isInitializing.current = false;
        return null;
      }
    },
    [socket, user, monitorConnectionQuality, handleConnectionFailure]
  );

  // Start a call
  const startCall = useCallback(
    async (recipientId: number, userName: string, userProfile: string) => {
      try {
        if (!user) {
          throw new Error('User not authenticated');
        }

        logWithTimestamp(`Starting call to user ${recipientId}`);

        // Request permissions first
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();

        if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
          throw new Error('Camera and microphone permissions are required');
        }

        // Clean up any existing calls
        cleanupMediaStreams();

        // Get media constraints based on network
        const constraints = await getMediaConstraints();

        logWithTimestamp('Getting user media with constraints:', constraints);
        const stream = await mediaDevices.getUserMedia(constraints);

        // Verify stream has both audio and video tracks
        if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
          throw new Error('Failed to get complete media stream');
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Initialize peer connection
        const peer = await initializePeerConnection(recipientId);
        if (!peer) {
          throw new Error('Failed to initialize peer connection');
        }

        // Add tracks to peer connection
        stream.getTracks().forEach((track: any) => {
          logWithTimestamp(`Adding ${track.kind} track to peer connection`);
          peer.addTrack(track, stream);
        });

        // Create offer
        logWithTimestamp('Creating offer');
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        // Set local description
        logWithTimestamp('Setting local description');
        await peer.setLocalDescription(offer);

        // Send offer to remote peer
        socket?.emit('call-user', {
          offer,
          to: recipientId,
          from: user.userid,
          name: user.name,
          profilepic: user?.profilepic,
        });

        setIsInCall(true);
        setCurrentCall({
          userid: recipientId,
          name: userName,
          profilepic: userProfile,
        });

        logWithTimestamp('Call setup complete, waiting for answer');
      } catch (error) {
        logWithTimestamp('Error starting call:', error);
        cleanupMediaStreams();
      }
    },
    [socket, user, initializePeerConnection, cleanupMediaStreams, getMediaConstraints]
  );

  // Answer an incoming call
  const answerCall = useCallback(async () => {
    try {
      if (!incomingCall) {
        throw new Error('No incoming call to answer');
      }

      logWithTimestamp(`Answering call from ${incomingCall.from}`);

      // Request permissions first
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();

      if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
        throw new Error('Camera and microphone permissions are required');
      }

      // Clean up any existing calls
      cleanupMediaStreams();

      // Get media constraints based on network
      const constraints = await getMediaConstraints();

      logWithTimestamp('Getting user media with constraints:', constraints);
      const stream = await mediaDevices.getUserMedia(constraints);

      // Set up local stream
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Initialize peer connection
      const peer = await initializePeerConnection(incomingCall.from);
      if (!peer) {
        throw new Error('Failed to initialize peer connection');
      }

      // Set remote description first (important for answering)
      logWithTimestamp('Setting remote description from offer');
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Add tracks to peer connection
      stream.getTracks().forEach((track: any) => {
        logWithTimestamp(`Adding ${track.kind} track to peer connection`);
        peer.addTrack(track, stream);
      });

      // Create answer
      logWithTimestamp('Creating answer');
      const answer = await peer.createAnswer();

      // Set local description
      logWithTimestamp('Setting local description');
      await peer.setLocalDescription(answer);

      // Send answer to remote peer
      socket?.emit('call-accepted', {
        answer,
        to: incomingCall.from,
        name: user?.name,
        profilepic: user?.profilepic,
      });

      setIsInCall(true);
      setCurrentCall({
        userid: incomingCall.from,
        name: incomingCall.name,
        profilepic: incomingCall.profilepic,
      });
      setIncomingCall(null);

      logWithTimestamp('Call answer complete');
    } catch (error) {
      logWithTimestamp('Error answering call:', error);
      cleanupMediaStreams();
    }
  }, [
    socket,
    incomingCall,
    user,
    initializePeerConnection,
    cleanupMediaStreams,
    getMediaConstraints,
  ]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    if (socket?.connected && incomingCall?.from) {
      logWithTimestamp(`Rejecting call from ${incomingCall.from}`);
      socket.emit('call-rejected', {
        to: incomingCall.from,
      });
    }
    setIncomingCall(null);
  }, [socket, incomingCall]);

  // End an ongoing call
  const endCall = useCallback(() => {
    if (socket?.connected && remotePeerIdRef.current) {
      logWithTimestamp(`Ending call with ${remotePeerIdRef.current}`);
      socket.emit('end-call', {
        to: remotePeerIdRef.current,
      });
    }
    cleanupMediaStreams();
  }, [socket, cleanupMediaStreams]);

  // Flip camera between front and back
  const flipCamera = useCallback(() => {
    if (!localStream) return;

    logWithTimestamp(
      `Flipping camera from ${cameraType} to ${cameraType === 'front' ? 'back' : 'front'}`
    );

    const newType = cameraType === 'front' ? 'back' : 'front';
    setCameraType(newType);

    // We need to get a new stream with the new camera
    const restartCamera = async () => {
      try {
        const constraints = await getMediaConstraints();
        logWithTimestamp('Getting new media stream for camera flip');
        const newStream = await mediaDevices.getUserMedia(constraints);

        if (localStreamRef.current) {
          // Stop old tracks
          localStreamRef.current.getTracks().forEach((track: any) => {
            track.stop();
          });

          // Replace tracks in the peer connection
          if (peerConnection.current) {
            const senders = peerConnection.current.getSenders();

            newStream.getTracks().forEach((track: any) => {
              const sender = senders.find((s) => s.track && s.track.kind === track.kind);
              if (sender) {
                logWithTimestamp(`Replacing ${track.kind} track`);
                sender.replaceTrack(track);
              }
            });
          }
        }

        localStreamRef.current = newStream;
        setLocalStream(newStream);
        logWithTimestamp('Camera flip complete');
      } catch (error) {
        logWithTimestamp('Error flipping camera:', error);
      }
    };

    restartCamera();
  }, [localStream, cameraType, getMediaConstraints]);

  // Toggle audio mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMuteState = !isMuted;

      audioTracks.forEach((track: any) => {
        track.enabled = !newMuteState;
      });

      setIsMuted(newMuteState);
      logWithTimestamp(`Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
    }
  }, [isMuted]);

  // Set up event listeners for call events
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: IncomingCall) => {
      logWithTimestamp(`Incoming call from ${data.from} (${data.name})`);
      setIncomingCall(data);
    };

    const handleCallAccepted = async (data: {
      answer: RTCSessionDescription;
      from: number;
      name: string;
      profilepic?: string;
    }) => {
      try {
        logWithTimestamp(`Call accepted by ${data.from} (${data.name})`);

        if (peerConnection.current && peerConnection.current.signalingState !== 'closed') {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));

          setCurrentCall({
            userid: data.from,
            name: data.name,
            profilepic: data.profilepic,
          });

          logWithTimestamp('Remote description set successfully');
        } else {
          logWithTimestamp('Cannot set remote description - peer connection is closed or null');
        }
      } catch (error) {
        logWithTimestamp('Error handling call acceptance:', error);
        endCall();
      }
    };

    const handleCallEnded = () => {
      logWithTimestamp('Call ended by remote peer');
      cleanupMediaStreams();
    };

    const handleCallRejected = () => {
      logWithTimestamp('Call rejected by remote peer');
      setCurrentCall(null);
      setIncomingCall(null);
      cleanupMediaStreams();
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidate }) => {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.remoteDescription &&
          peerConnection.current.signalingState !== 'closed'
        ) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          logWithTimestamp('Added ICE candidate');
        } else {
          logWithTimestamp('Skipped ICE candidate - no remote description or connection closed');
        }
      } catch (error) {
        logWithTimestamp('Error adding ICE candidate:', error);
      }
    };

    // Add event listeners
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-rejected', handleCallRejected);
    socket.on('ice-candidate', handleIceCandidate);

    // Clean up event listeners
    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-rejected', handleCallRejected);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [socket, endCall, cleanupMediaStreams]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupMediaStreams();
    };
  }, [cleanupMediaStreams]);

  // Context value
  const contextValue: VideoCallContextType = {
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
    flipCamera,
    toggleMute,
    isMuted,
    cameraType,
  };

  return <VideoCallContext.Provider value={contextValue}>{children}</VideoCallContext.Provider>;
};
