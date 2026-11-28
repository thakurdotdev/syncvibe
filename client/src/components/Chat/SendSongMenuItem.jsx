import { Send } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useChatStore } from '@/stores/chatStore';
import { usePlayerStore } from '@/stores/playerStore';
import { openSendSong } from '@/stores/sendSongStore';

/**
 * "Send in a chat" for the player's menus: sends the song that's on. Shown once signed in, which
 * is when chat has said who this is. Its own component so the menus don't take on the chat store.
 */
const SendSongMenuItem = ({ className }) => {
  const signedIn = useChatStore((s) => s.meId != null);
  const song = usePlayerStore((s) => s.currentSong);
  if (!signedIn || !song?.id) return null;
  return (
    <DropdownMenuItem onClick={() => openSendSong(song)} className={className}>
      <Send className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
      Send in a chat
    </DropdownMenuItem>
  );
};

export default SendSongMenuItem;
