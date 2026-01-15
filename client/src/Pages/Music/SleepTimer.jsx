import { usePlayerStore } from '@/stores/playerStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Clock, Music, Timer, X } from 'lucide-react';
import { useState } from 'react';

const SleepTimerModal = () => {
  // Individual selectors for sleep timer state
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  
  const { timeRemaining, songsRemaining, isActive } = sleepTimer;
  const [timerType, setTimerType] = useState('time');
  const [selectedTime, setSelectedTime] = useState(30);
  const [selectedSongs, setSelectedSongs] = useState(5);

  const handleSetTimer = () => {
    if (timerType === 'time') {
      setSleepTimer(selectedTime);
    } else {
      setSleepTimer(0, selectedSongs);
    }
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          size='icon'
          className='hover:scale-105 relative'
          type='button'
          onClick={(e) => e.stopPropagation()}
        >
          <Clock size={18} />
          {isActive && (
            <span className='absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full animate-pulse' />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Clock size={24} />
            Sleep Timer
          </DialogTitle>
        </DialogHeader>

        <Card className='w-full'>
          <CardContent className='p-6 space-y-4'>
            <RadioGroup
              defaultValue={timerType}
              onValueChange={setTimerType}
              className='grid grid-cols-2 gap-4'
            >
              <div>
                <RadioGroupItem value='time' id='time' className='peer sr-only' />
                <Label
                  htmlFor='time'
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                    timerType === 'time' ? 'border-primary' : ''
                  }`}
                >
                  <Timer className='mb-3' />
                  Time
                </Label>
              </div>
              <div>
                <RadioGroupItem value='songs' id='songs' className='peer sr-only' />
                <Label
                  htmlFor='songs'
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                    timerType === 'songs' ? 'border-primary' : ''
                  }`}
                >
                  <Music className='mb-3' />
                  Songs
                </Label>
              </div>
            </RadioGroup>

            {timerType === 'time' ? (
              <div className='space-y-2'>
                <Label>Duration (minutes)</Label>
                <Slider
                  defaultValue={[30]}
                  min={10}
                  max={120}
                  step={10}
                  onValueChange={(value) => setSelectedTime(value[0])}
                  className='w-full cursor-pointer'
                />
                <div className='flex justify-between text-sm text-muted-foreground'>
                  <span>10m</span>
                  <span>{selectedTime}m</span>
                  <span>120m</span>
                </div>
              </div>
            ) : (
              <div className='space-y-2'>
                <Label>Number of Songs</Label>
                <Slider
                  defaultValue={[5]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(value) => setSelectedSongs(value[0])}
                  className='w-full'
                />
                <div className='flex justify-between text-sm text-muted-foreground'>
                  <span>1</span>
                  <span>{selectedSongs}</span>
                  <span>20</span>
                </div>
              </div>
            )}

            {isActive && (
              <div className='flex items-center justify-between bg-secondary/30 p-3 rounded-lg'>
                <div className='flex items-center gap-2'>
                  <Badge variant='secondary'>
                    {timerType === 'time'
                      ? `Remaining: ${formatTime(timeRemaining)}`
                      : `Songs Left: ${songsRemaining}`}
                  </Badge>
                </div>
                <Button variant='destructive' size='sm' onClick={clearSleepTimer} className='gap-2'>
                  <X size={16} /> Cancel
                </Button>
              </div>
            )}

            <Button
              onClick={handleSetTimer}
              disabled={isActive}
              className='w-full'
              variant={isActive ? 'outline' : 'default'}
            >
              {isActive ? 'Timer Active' : 'Start Timer'}
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default SleepTimerModal;
