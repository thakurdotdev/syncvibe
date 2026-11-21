import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/*
 * A layer over the page (the full player, a conversation on a phone) gets its own history
 * entry, so Back closes it instead of leaving the page, and going anywhere else closes it too.
 * Open layers are listed in the entry's state under `layers`; the rest of the state is kept.
 */

const layersOf = (state) => (Array.isArray(state?.layers) ? state.layers : []);

// BrowserRouter keeps the page's state in `history.state.usr`. Reading it here rather than
// from a render means two layers changing in one tick both see the latest entry.
const currentState = () => {
  const state = window.history.state?.usr;
  return state && typeof state === 'object' ? state : {};
};

const currentPath = () => window.location.pathname + window.location.search + window.location.hash;

const withoutLayer = (state, name) => {
  const layers = layersOf(state).filter((layer) => layer !== name);
  const rest = { ...state };
  delete rest.layers;
  return layers.length ? { ...rest, layers } : rest;
};

/** `close` runs when Back (or leaving the page) takes the layer away. */
export const useBackCloses = (name, open, close) => {
  const location = useLocation();
  const navigate = useNavigate();
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  const wasOpen = useRef(false);

  // Opening adds the entry; closing from the layer itself (its close button, Escape) steps
  // back over it.
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    const listed = layersOf(currentState()).includes(name);
    if (open && !listed) {
      navigate(currentPath(), {
        state: { ...currentState(), layers: [...layersOf(currentState()), name] },
      });
    } else if (!open && listed) navigate(-1);
  }, [open, name, navigate]);

  // Back, or a link to another page: the entry no longer lists the layer, so it closes. An
  // entry that lists it while it's shut (after a reload, Forward, or Back from a page it led
  // to) drops it, so opening adds a fresh one rather than stepping back past the page.
  useEffect(() => {
    const listed = layersOf(currentState()).includes(name);
    if (wasOpen.current && !listed) closeRef.current();
    else if (!wasOpen.current && listed) {
      navigate(currentPath(), { replace: true, state: withoutLayer(currentState(), name) });
    }
    // When the page changes: opening and closing are handled above.
  }, [location.key, name, navigate]);
};
