import { Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { extensionOf, formatBytes, typeLabel } from '@/lib/attachments';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

/** Text past this is left out of the preview; the download has all of it. */
const MAX_TEXT_BYTES = 256 * 1024;

const iconButton =
  'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

/** Reads the start of a text file for the preview. */
const LOADING = { status: 'loading', text: '', cut: false };

const useText = (url, enabled) => {
  const [state, setState] = useState({ url: null, ...LOADING });
  useEffect(() => {
    if (!enabled || !url) return undefined;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, headers: { Range: `bytes=0-${MAX_TEXT_BYTES - 1}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const text = await response.text();
        setState({ url, status: 'ready', text, cut: response.status === 206 });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ url, status: 'error', text: '', cut: false });
      });
    return () => controller.abort();
  }, [url, enabled]);
  // What was read for another file is never shown for this one.
  return state.url === url ? state : LOADING;
};

/** A PDF or a text file, looked at without leaving the conversation. */
const FilePreview = ({ attachment, onClose, onDownload }) => {
  const open = Boolean(attachment);
  const isPdf = extensionOf(attachment?.name) === 'pdf';
  const text = useText(attachment?.url, open && !isPdf);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        closeButton={false}
        className='flex h-[min(88dvh,900px)] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0'
      >
        {attachment && (
          <>
            <div className='flex items-center gap-2 border-b border-border/60 py-2 pl-4 pr-2'>
              <div className='min-w-0 flex-1'>
                <DialogTitle className='truncate text-sm font-semibold'>
                  {attachment.name}
                </DialogTitle>
                <DialogDescription className='text-xs tabular-nums'>
                  {typeLabel(attachment.name)} · {formatBytes(attachment.size)}
                </DialogDescription>
              </div>
              <a
                href={attachment.url}
                target='_blank'
                rel='noopener noreferrer'
                className={iconButton}
                aria-label='Open in a new tab'
                title='Open in a new tab'
              >
                <ExternalLink className='h-4 w-4' />
              </a>
              <button
                type='button'
                className={iconButton}
                onClick={() => onDownload(attachment)}
                aria-label='Download'
                title='Download'
              >
                <Download className='h-4 w-4' />
              </button>
              <button
                type='button'
                className={iconButton}
                onClick={onClose}
                aria-label='Close'
                title='Close'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            <div className='min-h-0 flex-1 bg-muted/40'>
              {isPdf ? (
                <iframe
                  src={attachment.url}
                  title={attachment.name}
                  className='h-full w-full border-0'
                />
              ) : text.status === 'loading' ? (
                <div className='flex h-full items-center justify-center'>
                  <span className='h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground' />
                </div>
              ) : text.status === 'error' ? (
                <div className='flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground'>
                  <p>This file can't be shown here.</p>
                  <a
                    href={attachment.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-medium text-foreground underline underline-offset-4'
                  >
                    Open it in a new tab
                  </a>
                </div>
              ) : (
                <div className='h-full overflow-auto'>
                  <pre className='whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed wrap-anywhere text-foreground'>
                    {text.text}
                  </pre>
                  {text.cut && (
                    <p className='px-4 pb-4 text-xs text-muted-foreground'>
                      Only the start is shown. Download the file to see all of it.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
