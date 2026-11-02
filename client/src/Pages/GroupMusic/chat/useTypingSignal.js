import { useCallback, useEffect, useRef } from 'react';

const IDLE_TIMEOUT_MS = 2000;
// Receivers expire a typing indicator after 3s, so refresh it before then.
const REFRESH_INTERVAL_MS = 1500;

/** Emits throttled typing-start signals while the user types and a stop after a pause. */
export const useTypingSignal = ({ onTypingStart, onTypingStop, disabled }) => {
  const idleTimerRef = useRef(null);
  const lastStartRef = useRef(0);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };

  const stopTyping = useCallback(() => {
    if (!idleTimerRef.current) return;
    clearIdleTimer();
    lastStartRef.current = 0;
    onTypingStop?.();
  }, [onTypingStop]);

  const notifyTyping = useCallback(() => {
    if (disabled) return;
    const now = Date.now();
    if (now - lastStartRef.current > REFRESH_INTERVAL_MS) {
      lastStartRef.current = now;
      onTypingStart?.();
    }
    clearIdleTimer();
    idleTimerRef.current = setTimeout(stopTyping, IDLE_TIMEOUT_MS);
  }, [disabled, onTypingStart, stopTyping]);

  useEffect(() => clearIdleTimer, []);

  return { notifyTyping, stopTyping };
};
