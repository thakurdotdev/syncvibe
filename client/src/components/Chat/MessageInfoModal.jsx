import { Check, CheckCheck, Info } from 'lucide-react';
import { messageStatus } from '@/stores/chatStore';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { formatFullDateTime } from './ChatDateUtils';

const Row = ({ icon, label, value }) => (
  <div className='flex items-start gap-3 rounded-lg border bg-card p-3'>
    <div className='mt-0.5 text-muted-foreground'>{icon}</div>
    <div className='flex-1'>
      <div className='text-sm font-semibold text-foreground'>{label}</div>
      <div className='text-xs text-muted-foreground'>{value}</div>
    </div>
  </div>
);

const MessageInfoModal = ({ message, conversation, onClose }) => {
  const status = message ? messageStatus(message, conversation) : null;
  const delivered = status === 'delivered' || status === 'read';
  // The time is known only for the latest message the other person has read.
  const readAt =
    status === 'read' && message.id === conversation.peerLastReadMessageId
      ? formatFullDateTime(conversation.peerLastReadAt)
      : null;

  return (
    <AlertDialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className='max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <Info className='h-5 w-5 text-primary' />
            Message info
          </AlertDialogTitle>
        </AlertDialogHeader>

        {message?.body && (
          <div className='mb-2 max-h-28 overflow-y-auto rounded-lg bg-muted/60 p-3 text-sm text-foreground wrap-anywhere'>
            {message.body}
          </div>
        )}

        <div className='my-2 space-y-3'>
          <Row
            icon={<Check size={16} />}
            label='Sent'
            value={formatFullDateTime(message?.createdAt)}
          />
          <Row
            icon={<CheckCheck size={16} />}
            label='Delivered'
            value={delivered ? 'Delivered' : 'Not yet'}
          />
          <Row
            icon={<CheckCheck size={16} strokeWidth={2.6} className='text-foreground' />}
            label='Read'
            value={status === 'read' ? readAt || 'Read' : 'Not yet'}
          />
          {message?.editedAt && (
            <Row
              icon={<Info size={16} />}
              label='Edited'
              value={formatFullDateTime(message.editedAt)}
            />
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MessageInfoModal;
