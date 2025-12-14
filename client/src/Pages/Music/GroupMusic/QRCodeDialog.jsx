import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const QRCodeDialog = ({ isOpen, onClose, group }) => {
  const [copied, setCopied] = useState(false);

  if (!group?.qrCode) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(group.id);
      setCopied(true);
      toast.success('Group ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${group.qrCode}`;
    link.download = `syncvibe-${group.id}.png`;
    link.click();
    toast.success('QR code downloaded');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl font-bold text-center'>Share Group</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col items-center space-y-6 py-4'>
          {/* Group Name */}
          <div className='text-center'>
            <p className='text-lg font-medium'>{group.name}</p>
            <p className='text-sm text-muted-foreground font-mono'>{group.id}</p>
          </div>

          {/* QR Code */}
          <div className='relative p-4 rounded-2xl bg-white shadow-xl'>
            <img
              src={`data:image/png;base64,${group.qrCode}`}
              alt='Group QR Code'
              className='w-56 h-56'
            />
          </div>

          {/* Instructions */}
          <p className='text-sm text-center text-muted-foreground max-w-xs'>
            Share this QR code with friends to let them join your music session instantly
          </p>

          {/* Actions */}
          <div className='flex gap-3 w-full max-w-xs'>
            <Button onClick={handleCopy} variant='outline' className='flex-1 rounded-full'>
              {copied ? (
                <>
                  <Check className='mr-2 h-4 w-4 text-green-500' />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className='mr-2 h-4 w-4' />
                  Copy ID
                </>
              )}
            </Button>
            <Button onClick={handleDownload} className='flex-1 rounded-full'>
              <Download className='mr-2 h-4 w-4' />
              Save QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(QRCodeDialog);
