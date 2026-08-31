import { useEffect, useState, memo } from 'react';
import axios from 'axios';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Copy,
  Download,
  History,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const formatBytes = (bytes) => {
  if (!bytes || Number(bytes) <= 0) return null;
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const DEFAULT_DOWNLOAD_URL = `${import.meta.env.VITE_API_URL}/api/app-update/download`;

const ReleasesPage = () => {
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [allUpdates, setAllUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedSha, setCopiedSha] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState({});

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      setLoading(true);
      const [latestRes, allRes] = await Promise.allSettled([
        axios.get(`${import.meta.env.VITE_API_URL}/api/app-update/latest`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/app-update/all`),
      ]);

      if (latestRes.status === 'fulfilled' && latestRes.value.data?.success) {
        setLatestUpdate(latestRes.value.data.latest);
      }

      if (allRes.status === 'fulfilled' && allRes.value.data?.success) {
        setAllUpdates(allRes.value.data.updates || []);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySha = (sha) => {
    if (!sha) return;
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    toast.success('SHA-256 checksum copied to clipboard');
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const toggleVersion = (version) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const downloadUrl = latestUpdate?.downloadUrl || DEFAULT_DOWNLOAD_URL;
  const version = latestUpdate?.version || '';
  const formattedSize = formatBytes(latestUpdate?.fileSize);

  return (
    <div className='min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-foreground px-4 sm:px-6 pt-28 pb-24'>
      <div className='max-w-4xl mx-auto space-y-12'>
        {/* Header Title */}
        <div className='text-center max-w-xl mx-auto space-y-3'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-mono text-muted-foreground'>
            <Smartphone size={13} className='text-primary' />
            <span>SyncVibe for Android</span>
          </div>

          <h1 className='text-3xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight'>
            Downloads & Releases
          </h1>

          <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed font-normal'>
            Download the latest APK build directly or review past release notes and checksums.
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className='py-20 flex flex-col items-center justify-center space-y-3'>
            <Loader2 className='w-6 h-6 animate-spin text-primary' />
            <span className='text-xs text-muted-foreground font-mono'>
              Fetching latest build...
            </span>
          </div>
        ) : (
          <>
            {/* Latest Release Primary Card */}
            <div className='rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl'>
              {/* Header Info */}
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80'>
                <div className='space-y-1.5'>
                  <div className='flex items-center gap-2.5'>
                    <h2 className='text-xl sm:text-2xl font-bold text-foreground tracking-tight font-mono'>
                      v{version}
                    </h2>
                    <span className='px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold font-mono'>
                      LATEST
                    </span>
                    {latestUpdate?.critical && (
                      <span className='px-2.5 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30 text-[10px] font-semibold'>
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground font-mono'>
                    Released on {formatDate(latestUpdate?.createdAt || new Date())}
                  </p>
                </div>

                <a href={downloadUrl} target='_blank' rel='noopener noreferrer'>
                  <Button
                    size='lg'
                    className='w-full sm:w-auto h-11 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs cursor-pointer shadow-lg shadow-primary/25 transition-all active:scale-98'
                  >
                    <ArrowDownToLine className='mr-2 h-4 w-4' />
                    <span>Download APK {formattedSize ? `(${formattedSize})` : ''}</span>
                  </Button>
                </a>
              </div>

              {/* Release Metadata */}
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                <div className='p-3.5 rounded-xl bg-secondary/60 border border-border space-y-1'>
                  <div className='text-[10.5px] font-mono text-muted-foreground uppercase'>
                    Architecture
                  </div>
                  <div className='text-xs font-semibold text-foreground font-mono'>
                    Universal APK
                  </div>
                </div>

                <div className='p-3.5 rounded-xl bg-secondary/60 border border-border space-y-1'>
                  <div className='text-[10.5px] font-mono text-muted-foreground uppercase'>
                    Compatibility
                  </div>
                  <div className='text-xs font-semibold text-foreground'>Android 8.0 & Higher</div>
                </div>

                <div className='p-3.5 rounded-xl bg-secondary/60 border border-border space-y-1'>
                  <div className='text-[10.5px] font-mono text-muted-foreground uppercase'>
                    Package Verification
                  </div>
                  <div className='text-xs font-semibold text-emerald-400 flex items-center gap-1'>
                    <ShieldCheck size={13} />
                    <span>Signed Release Build</span>
                  </div>
                </div>
              </div>

              {/* SHA-256 Checksum Box */}
              {latestUpdate?.sha256 && (
                <div className='p-3.5 rounded-xl bg-secondary/40 border border-border flex items-center justify-between gap-3 text-xs'>
                  <div className='min-w-0 space-y-0.5'>
                    <div className='text-[10.5px] font-mono text-muted-foreground uppercase'>
                      SHA-256 Checksum
                    </div>
                    <div className='font-mono text-[11px] text-foreground truncate'>
                      {latestUpdate.sha256}
                    </div>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleCopySha(latestUpdate.sha256)}
                    className='h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0 text-xs'
                  >
                    {copiedSha ? (
                      <span className='text-emerald-400 flex items-center gap-1'>
                        <Check size={12} /> Copied
                      </span>
                    ) : (
                      <span className='flex items-center gap-1'>
                        <Copy size={12} /> Copy
                      </span>
                    )}
                  </Button>
                </div>
              )}

              {/* Release Notes */}
              {latestUpdate?.releaseNotes && (
                <div className='space-y-2 pt-2'>
                  <h3 className='text-xs font-semibold text-foreground uppercase tracking-wider font-mono'>
                    What's New in v{version}
                  </h3>
                  <div className='p-4 rounded-xl bg-secondary/30 border border-border text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line'>
                    {latestUpdate.releaseNotes}
                  </div>
                </div>
              )}
            </div>

            {/* How to Install Guide */}
            <div className='rounded-2xl border border-border bg-card/60 p-6 space-y-4'>
              <h3 className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <Info size={15} className='text-primary' />
                How to install the APK on Android
              </h3>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground'>
                <div className='space-y-1'>
                  <span className='font-mono text-foreground font-semibold'>1. Download</span>
                  <p>Tap the Download APK button above to save the file to your device.</p>
                </div>
                <div className='space-y-1'>
                  <span className='font-mono text-foreground font-semibold'>2. Allow Install</span>
                  <p>When prompted, allow your browser to install apps from this source.</p>
                </div>
                <div className='space-y-1'>
                  <span className='font-mono text-foreground font-semibold'>3. Open & Sync</span>
                  <p>Open SyncVibe, log in to your account, and start streaming in sync!</p>
                </div>
              </div>
            </div>

            {/* Previous Releases History */}
            {allUpdates.length > 1 && (
              <div className='space-y-4 pt-4'>
                <div className='flex items-center gap-2'>
                  <History size={15} className='text-muted-foreground' />
                  <h3 className='text-sm font-semibold text-foreground'>Release History</h3>
                </div>

                <div className='space-y-2.5'>
                  {allUpdates
                    .filter((u) => u.version !== latestUpdate?.version)
                    .map((update) => {
                      const isExpanded = !!expandedVersions[update.version];
                      const updateSize = formatBytes(update.fileSize);
                      return (
                        <div
                          key={update.id || update.version}
                          className='rounded-xl border border-border bg-card/40 overflow-hidden transition-colors'
                        >
                          <div
                            className='p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/40'
                            onClick={() => toggleVersion(update.version)}
                          >
                            <div className='flex items-center gap-3 min-w-0'>
                              <span className='font-mono font-semibold text-xs text-foreground'>
                                v{update.version}
                              </span>
                              <span className='text-muted-foreground/60 text-xs font-mono'>
                                {formatDate(update.createdAt)}
                              </span>
                              {updateSize && (
                                <>
                                  <span className='text-muted-foreground/40 text-xs'>•</span>
                                  <span className='text-muted-foreground text-xs font-mono'>
                                    {updateSize}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className='flex items-center gap-3'>
                              {update.downloadUrl && (
                                <a
                                  href={update.downloadUrl}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  onClick={(e) => e.stopPropagation()}
                                  className='text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 py-1 px-2.5 rounded-lg bg-secondary border border-border'
                                >
                                  <Download size={12} />
                                  <span>APK</span>
                                </a>
                              )}
                              <ChevronDown
                                size={14}
                                className={cn(
                                  'text-muted-foreground transition-transform duration-200',
                                  isExpanded && 'transform rotate-180'
                                )}
                              />
                            </div>
                          </div>

                          {isExpanded && update.releaseNotes && (
                            <div className='px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border whitespace-pre-line'>
                              {update.releaseNotes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(ReleasesPage);
