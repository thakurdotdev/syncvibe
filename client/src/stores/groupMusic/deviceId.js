const KEY = 'syncvibe_device_id';

/**
 * Identifies this tab to the server, so it can tell this tab reconnecting from another device or
 * tab of yours joining the same room. Per tab, because two tabs would play over each other just
 * as two devices would. Random, and used for nothing else.
 */
export const getDeviceId = () => {
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
};
