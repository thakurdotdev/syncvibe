/**
 * The browser-to-browser connection of one video call (WebRTC), without anything about who is
 * calling whom: it is given the servers to use and a way to send messages to the other side, and
 * reports what it sees.
 *
 * Both sides may need to renegotiate at any time (a network change, a camera turned on), also at
 * the same moment. That is settled the standard way ("perfect negotiation"): one side is polite
 * and gives way when both make an offer at once.
 */

/** Plenty for 720p, and it keeps a relayed call's use of the TURN allowance modest. */
const MAX_VIDEO_BITRATE = 2_000_000;
const MAX_RELAYED_VIDEO_BITRATE = 1_200_000;
/** A short network gap usually heals by itself; after this the route is found again. */
const RESTART_AFTER_DISCONNECTED_MS = 3000;
const STATS_EVERY_MS = 2000;

const qualityOf = ({ lossRate, roundTrip }) => {
  if (lossRate > 0.08 || roundTrip > 0.6) return 'poor';
  if (lossRate > 0.03 || roundTrip > 0.3) return 'fair';
  return 'good';
};

/**
 * @param {object} options
 * @param {RTCIceServer[]} options.iceServers
 * @param {boolean} options.polite          the side that gives way; here, the one who was called
 * @param {MediaStream} options.stream      camera and microphone to send
 * @param {(message: object) => void} options.send   to the other side, through the server
 * @param {(stream: MediaStream) => void} options.onRemoteStream
 * @param {(state: 'connecting' | 'connected' | 'reconnecting') => void} options.onState
 * @param {(quality: 'good' | 'fair' | 'poor') => void} options.onQuality
 */
export const createCallPeer = ({
  iceServers,
  polite,
  stream,
  send,
  onRemoteStream,
  onState,
  onQuality,
}) => {
  const pc = new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
    // Starts finding routes at once, while the other side is still ringing.
    iceCandidatePoolSize: 1,
  });

  const remoteStream = new MediaStream();
  let closed = false;
  /** Offers are held back until the call is answered (caller) or the first offer is in (callee). */
  let open = false;
  let makingOffer = false;
  let ignoreOffer = false;
  let settingRemoteAnswer = false;
  let everConnected = false;
  let restartTimer = null;
  let statsTimer = null;
  let relayed = null;

  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  // The caller's offer always has a video line, so the other side's camera is seen, and their own
  // can be turned on later, even when the call started without a camera here.
  if (!polite && stream.getVideoTracks().length === 0) {
    pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] });
  }

  const negotiate = async () => {
    if (closed || !open) return;
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      send({ description: pc.localDescription.toJSON() });
    } catch (error) {
      console.error('Call offer failed:', error);
    } finally {
      makingOffer = false;
    }
  };

  pc.onnegotiationneeded = negotiate;

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) send({ candidate: candidate.toJSON() });
  };

  pc.ontrack = ({ track }) => {
    if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
    onRemoteStream(remoteStream);
  };

  // ── Messages from the other side, one at a time and in order ──────────────

  const handle = async ({ description, candidate }) => {
    if (closed) return;
    if (description) {
      const readyForOffer = !makingOffer && (pc.signalingState === 'stable' || settingRemoteAnswer);
      const collision = description.type === 'offer' && !readyForOffer;
      ignoreOffer = !polite && collision;
      if (ignoreOffer) return;

      settingRemoteAnswer = description.type === 'answer';
      await pc.setRemoteDescription(description);
      settingRemoteAnswer = false;

      if (description.type === 'offer') {
        await pc.setLocalDescription();
        send({ description: pc.localDescription.toJSON() });
        open = true;
      }
    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        // Candidates of an offer we chose to ignore have nowhere to go.
        if (!ignoreOffer) throw error;
      }
    }
  };

  let inbox = Promise.resolve();
  const receive = (message) => {
    inbox = inbox
      .then(() => handle(message))
      .catch((error) => console.error('Call signal failed:', error));
  };

  // ── Connection state ──────────────────────────────────────────────────────

  const restart = () => {
    if (closed || !open) return;
    clearTimeout(restartTimer);
    restartTimer = null;
    pc.restartIce();
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    clearTimeout(restartTimer);
    restartTimer = null;
    if (state === 'failed') restart();
    else if (state === 'disconnected') {
      restartTimer = setTimeout(restart, RESTART_AFTER_DISCONNECTED_MS);
    }
  };

  pc.onconnectionstatechange = () => {
    if (closed) return;
    const state = pc.connectionState;
    if (state === 'connected') {
      everConnected = true;
      onState('connected');
      void tuneVideo();
      startStats();
    } else if (state === 'disconnected' || state === 'failed') {
      onState(everConnected ? 'reconnecting' : 'connecting');
    }
  };

  // ── Quality ───────────────────────────────────────────────────────────────

  const sendersOf = (kind) =>
    pc
      .getTransceivers()
      .filter((transceiver) => transceiver.receiver.track?.kind === kind)
      .map((transceiver) => transceiver.sender);

  const tuneVideo = async () => {
    const [sender] = sendersOf('video');
    if (!sender) return;
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings?.length) return;
      parameters.encodings[0].maxBitrate = relayed ? MAX_RELAYED_VIDEO_BITRATE : MAX_VIDEO_BITRATE;
      await sender.setParameters(parameters);
    } catch {
      // The browser's own limits apply.
    }
  };

  const startStats = () => {
    if (statsTimer) return;
    let lastLost = 0;
    let lastReceived = 0;

    statsTimer = setInterval(async () => {
      if (closed || pc.connectionState !== 'connected') return;
      let report;
      try {
        report = await pc.getStats();
      } catch {
        return;
      }

      let lost = 0;
      let received = 0;
      let pair = null;
      let selectedPairId = null;
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp') {
          lost += stat.packetsLost || 0;
          received += stat.packetsReceived || 0;
        } else if (stat.type === 'transport' && stat.selectedCandidatePairId) {
          selectedPairId = stat.selectedCandidatePairId;
        } else if (stat.type === 'candidate-pair' && stat.selected) {
          pair = stat; // Firefox marks the pair itself.
        }
      });
      if (selectedPairId) pair = report.get(selectedPairId) ?? pair;

      const deltaLost = Math.max(0, lost - lastLost);
      const deltaReceived = Math.max(0, received - lastReceived);
      lastLost = lost;
      lastReceived = received;
      const total = deltaLost + deltaReceived;
      onQuality(
        qualityOf({
          lossRate: total > 0 ? deltaLost / total : 0,
          roundTrip: pair?.currentRoundTripTime ?? 0,
        })
      );

      const viaRelay =
        report.get(pair?.localCandidateId)?.candidateType === 'relay' ||
        report.get(pair?.remoteCandidateId)?.candidateType === 'relay';
      if (pair && viaRelay !== relayed) {
        relayed = viaRelay;
        void tuneVideo();
      }
    }, STATS_EVERY_MS);
  };

  // ── What the call does with it ────────────────────────────────────────────

  return {
    /** The call was answered: the caller makes the first offer. */
    start: () => {
      if (open) return;
      open = true;
      void negotiate();
    },

    receive,

    /**
     * After the connection to the server was down, on either side: messages sent meanwhile were
     * lost. An offer still waiting for its answer is sent again, and a broken route is rebuilt.
     */
    resync: () => {
      if (closed || !open) return;
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        send({ description: pc.localDescription.toJSON() });
      } else if (pc.connectionState !== 'connected') {
        restart();
      }
    },

    /** The network changed under the call (Wi-Fi to mobile data, say): find a route again. */
    restart,

    /** Swaps what is being sent, or stops sending it with `null`. No renegotiation when it can be avoided. */
    setTrack: async (kind, track) => {
      if (closed) return;
      const transceiver = pc.getTransceivers().find((t) => t.receiver.track?.kind === kind);
      if (!transceiver) {
        if (track) pc.addTrack(track, stream);
        return;
      }
      await transceiver.sender.replaceTrack(track);
      if (track && !transceiver.direction.startsWith('send')) transceiver.direction = 'sendrecv';
      if (track && kind === 'video') void tuneVideo();
    },

    isConnected: () => pc.connectionState === 'connected',

    close: () => {
      closed = true;
      clearTimeout(restartTimer);
      clearInterval(statsTimer);
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.close();
    },
  };
};
