/**
 * The chat list after a message: new preview, and the conversation moves to the top. Returns null
 * if the chat isn't in the list, meaning someone has messaged for the first time and the list has
 * to be fetched to learn who they are.
 */
export const bumpChat = <T extends { chatid?: number | string; lastmessage?: string | null }>(
  list: T[],
  chatid: number | string | undefined,
  lastmessage: string
): T[] | null => {
  const index = list.findIndex((chat) => String(chat.chatid) === String(chatid));
  if (index === -1) return null;
  return [{ ...list[index], lastmessage }, ...list.slice(0, index), ...list.slice(index + 1)];
};
