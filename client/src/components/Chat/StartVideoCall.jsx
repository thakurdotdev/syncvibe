import { useState } from 'react';
import { VideoIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const VideoCallButton = ({ startCall, currentChat, incomingCall }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleStartCall = () => {
    setIsOpen(false);
    startCall(currentChat?.otherUser?.userid);
  };

  if (incomingCall) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='rounded-full h-12 w-12'
          title='Start Video Call'
        >
          <VideoIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start Video Call</AlertDialogTitle>
          <AlertDialogDescription>
            Would you like to start a video call with {currentChat?.otherUser?.name}? Make sure your
            camera/microphone permissions are enabled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleStartCall}>Start Call</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VideoCallButton;
