import { toast } from 'sonner';
import { sendSong } from '@/lib/chat';
import { songName } from '@/lib/chatSongs';
import { closeSendSong, useSendSongStore } from '@/stores/sendSongStore';
import SendToChatDialog from './SendToChatDialog';

/** "Send in a chat" from any song menu: pick a conversation and the song goes there. */
const SendSongToChat = () => {
  const song = useSendSongStore((s) => s.song);

  const send = (conversation) => {
    const picked = song;
    closeSendSong();
    const name = conversation.peer.name?.split(' ')[0] || conversation.peer.name;
    sendSong(conversation.id, picked)
      .then((result) => {
        if (result === 'sent') toast.success(`Sent to ${name}`);
        else if (result === 'queued') toast(`Sending to ${name} when you're back online`);
        else toast.error(`Couldn't send it to ${name}. Try again from the chat.`);
      })
      .catch(() => toast.error("Couldn't send the song. Try again."));
  };

  return (
    <SendToChatDialog
      open={Boolean(song)}
      onOpenChange={(open) => !open && closeSendSong()}
      title='Send to…'
      subtitle={song ? songName(song) : undefined}
      onPick={send}
    />
  );
};

export default SendSongToChat;
