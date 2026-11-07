import axios from 'axios';

export const getAllMessages = async (chatid) => {
  try {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/get/messages/${chatid}`, {
      withCredentials: true,
    });

    if (response.status == 200) {
      return response.data.chats;
    }
  } catch (error) {
    toast.error(error);
  }
};

/**
 * The chat list after a message: new preview, and the conversation moves to the top. Returns null
 * if the chat isn't in the list, meaning someone has messaged for the first time and the list has
 * to be fetched to learn who they are.
 */
export const bumpChat = (list, chatid, lastmessage) => {
  const index = list.findIndex((chat) => String(chat.chatid) === String(chatid));
  if (index === -1) return null;
  return [{ ...list[index], lastmessage }, ...list.slice(0, index), ...list.slice(index + 1)];
};
