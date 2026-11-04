import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Music, MessageCircle, Users, Zap } from 'lucide-react';

const FEATURE_META = {
  realtimeChat: {
    icon: MessageCircle,
    title: 'Real-time Group Chat',
    description: 'Chat with your group members while listening together',
  },
  queueLimit: {
    icon: Music,
    title: 'Unlimited Queue',
    description: 'Add up to 50 songs to your group queue',
  },
  groupMembers: {
    icon: Users,
    title: 'Larger Groups',
    description: 'Invite up to 10 friends to your listening session',
  },
  realtimeSync: {
    icon: Zap,
    title: 'Real-time Sync',
    description: "Keep everyone's playback perfectly in sync",
  },
  default: {
    icon: Sparkles,
    title: 'PRO Feature',
    description: 'Unlock this feature with a PRO subscription',
  },
};

const UpgradeDialog = ({ open, onOpenChange, feature = 'default', customMessage }) => {
  const navigate = useNavigate();
  const meta = FEATURE_META[feature] || FEATURE_META.default;
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm'>
        <DialogHeader className='items-center text-center gap-3'>
          <div className='p-4 rounded-full bg-gradient-to-br from-foreground/20 to-foreground/20'>
            <Crown className='h-8 w-8 text-foreground' />
          </div>
          <DialogTitle className='text-xl'>{meta.title}</DialogTitle>
          <DialogDescription className='text-sm'>
            {customMessage || meta.description}
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center gap-3 p-3 rounded-lg bg-accent/50 mt-2'>
          <div className='p-2 rounded-full bg-primary/10 shrink-0'>
            <Icon className='h-4 w-4 text-primary' />
          </div>
          <p className='text-xs text-muted-foreground'>
            Upgrade to PRO to unlock this and all other premium features
          </p>
        </div>

        <div className='flex flex-col gap-2 mt-2'>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/plans');
            }}
            className='gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground'
          >
            <Sparkles className='h-4 w-4' />
            Upgrade to PRO
          </Button>
          <Button
            variant='ghost'
            onClick={() => onOpenChange(false)}
            className='rounded-full text-sm'
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(UpgradeDialog);
