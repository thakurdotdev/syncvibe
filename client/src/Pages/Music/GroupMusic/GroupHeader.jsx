import { memo, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Music, Search, Copy, QrCode, LogOut, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Memoized Title Section
const TitleSection = memo(({ currentGroup, isRejoining }) => (
  <div className='flex items-center gap-2 md:gap-3'>
    <div className='p-1.5 md:p-2 rounded-lg md:rounded-xl bg-primary/10'>
      <Music className='h-5 w-5 md:h-6 md:w-6 text-primary' />
    </div>
    <div>
      <h1 className='text-lg md:text-2xl font-bold'>Group Session</h1>
      {currentGroup && (
        <p className='text-xs md:text-sm text-muted-foreground line-clamp-1'>{currentGroup.name}</p>
      )}
    </div>
    {isRejoining && (
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        <RefreshCw className='h-3 w-3 md:h-4 md:w-4 animate-spin' />
        <span className='hidden sm:inline'>Reconnecting...</span>
      </div>
    )}
  </div>
));

// Memoized Group ID Badge
const GroupIdBadge = memo(({ groupId, onCopy, onQRCodeOpen, copied }) => {
  const shortId = useMemo(() => groupId?.replace('syncvibe_', '') || '', [groupId]);

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 md:gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-full',
        'bg-accent/50 border border-border/50',
        'text-xs md:text-sm font-mono'
      )}
    >
      <span className='font-medium truncate max-w-[80px] md:max-w-[120px]'>{shortId}</span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onCopy} variant='ghost' size='icon' className='h-5 w-5 md:h-6 md:w-6'>
              {copied ? (
                <Check className='h-2.5 w-2.5 md:h-3 md:w-3 text-green-500' />
              ) : (
                <Copy className='h-2.5 w-2.5 md:h-3 md:w-3' />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy Group ID</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onQRCodeOpen}
              variant='ghost'
              size='icon'
              className='h-5 w-5 md:h-6 md:w-6'
            >
              <QrCode className='h-2.5 w-2.5 md:h-3 md:w-3' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show QR Code</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

// Main GroupHeader Component
const GroupHeader = ({ currentGroup, isRejoining, onSearchOpen, onQRCodeOpen, onLeaveGroup }) => {
  const [copied, setCopied] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!currentGroup?.id) return;

    try {
      await navigator.clipboard.writeText(currentGroup.id);
      setCopied(true);
      toast.success('Group ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  }, [currentGroup?.id]);

  const handleLeaveClick = useCallback(() => {
    setShowLeaveDialog(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveDialog(false);
    onLeaveGroup();
  }, [onLeaveGroup]);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveDialog(false);
  }, []);

  return (
    <>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 md:pb-4'>
        <TitleSection currentGroup={currentGroup} isRejoining={isRejoining} />

        {currentGroup && (
          <div className='flex items-center gap-1.5 md:gap-2 w-full sm:w-auto justify-end'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onSearchOpen}
                    variant='outline'
                    size='sm'
                    className='rounded-full h-8 md:h-9'
                  >
                    <Search className='h-4 w-4' />
                    <span className='ml-2'>Search</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search for songs to play</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <GroupIdBadge
              groupId={currentGroup.id}
              onCopy={handleCopy}
              onQRCodeOpen={onQRCodeOpen}
              copied={copied}
            />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleLeaveClick}
                    variant='destructive'
                    size='icon'
                    className='rounded-full shrink-0 h-8 w-8 md:h-9 md:w-9'
                  >
                    <LogOut className='h-3.5 w-3.5 md:h-4 md:w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Leave Group</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{currentGroup?.name}"? You'll stop listening with the
              group and your session will end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLeaveCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveConfirm}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(GroupHeader);
