import { AlertTriangle, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DangerZoneTab = memo(({ onDeleteAccount }) => {
  return (
    <Card className='border-destructive/30 bg-destructive/5 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
      <CardHeader className='pb-4'>
        <div className='flex items-center gap-2.5'>
          <div className='p-2 rounded-xl bg-destructive/10 text-destructive'>
            <AlertTriangle size={20} />
          </div>
          <div>
            <CardTitle className='text-lg font-semibold text-destructive'>Delete Account</CardTitle>
            <CardDescription className='text-xs text-destructive/80'>
              Permanently erase your SyncVibe account and personal data
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive/90 space-y-2'>
          <p className='font-semibold text-sm'>Warning: This action is irreversible.</p>
          <ul className='list-disc list-inside space-y-1 text-xs'>
            <li>
              All your playlists, listening history, and saved preferences will be permanently
              wiped.
            </li>
            <li>Your posts, stories, followers, and chat conversations will be deleted.</li>
            <li>You will be immediately logged out of all connected devices and sessions.</li>
          </ul>
        </div>

        <div className='flex justify-end pt-2'>
          <Button
            variant='destructive'
            onClick={onDeleteAccount}
            className='gap-2 rounded-xl h-9 px-4 text-xs font-semibold cursor-pointer shadow-sm shadow-destructive/20'
          >
            <Trash2 size={15} />
            Permanently Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

DangerZoneTab.displayName = 'DangerZoneTab';
export default DangerZoneTab;
