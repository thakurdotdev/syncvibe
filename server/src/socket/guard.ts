import type { Socket } from 'socket.io';

type Listener = (...args: unknown[]) => unknown;

/**
 * Socket.IO calls listeners from a tick of its own, so one that throws (a payload that isn't the
 * shape it expects) reaches `uncaughtException`, which ends the process for everyone. Every
 * listener added to the socket after this is contained: it fails alone and is logged.
 */
export const containListenerErrors = (socket: Socket): void => {
  const on = socket.on.bind(socket) as (event: string, listener: Listener) => Socket;

  socket.on = ((event: string, listener: Listener) => {
    const failed = (error: unknown) => console.error(`Socket event ${event} failed:`, error);
    const contained = (...args: unknown[]) => {
      try {
        const result = listener.apply(socket, args);
        if (result instanceof Promise) result.catch(failed);
      } catch (error) {
        failed(error);
      }
    };
    // What `removeListener` matches on, so taking a listener off still works.
    return on(event, Object.assign(contained, { listener }));
  }) as Socket['on'];
};
