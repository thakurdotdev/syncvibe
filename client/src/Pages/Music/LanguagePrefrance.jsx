import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Music, X } from 'lucide-react';
import { useState } from 'react';

const LanguagePreference = () => {
  const validLangs = [
    'hindi',
    'maithili',
    'bhojpuri',
    'english',
    'gujarati',
    'punjabi',
    'tamil',
    'telugu',
    'marathi',
    'bengali',
    'kannada',
    'malayalam',
    'urdu',
    'haryanvi',
    'rajasthani',
    'odia',
    'assamese',
  ];

  const [selectedLangs, setSelectedLangs] = useState(new Set(['hindi']));
  const [showAlert, setShowAlert] = useState(false);

  const handleLanguageToggle = (lang) => {
    setSelectedLangs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        if (newSet.size > 1) {
          newSet.delete(lang);
        }
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  };

  const handleSkip = () => {
    setSelectedLangs(new Set(['hindi']));
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const handleContinue = () => {
    console.log('Selected languages:', Array.from(selectedLangs).join(', '));
  };

  return (
    <div className='h-[calc(100vh-60px)] bg-background flex flex-col items-center justify-center'>
      <div className='w-full max-w-5xl space-y-8'>
        {/* Header Section */}
        <div className='text-center space-y-4'>
          <div className='space-y-2'>
            <h1 className='text-4xl font-bold tracking-tight'>Welcome to SyncVibe Music</h1>
            <p className='text-muted-foreground text-lg'>Customize your musical journey</p>
          </div>
        </div>

        {/* Selected Languages Display */}
        <div className='flex flex-wrap gap-2 justify-center'>
          {Array.from(selectedLangs).map((lang) => (
            <Badge key={lang} variant='secondary' className='text-sm py-1 px-3 capitalize'>
              {lang}
              {selectedLangs.size > 1 && (
                <X
                  className='ml-2 h-3 w-3 cursor-pointer inline-block'
                  onClick={() => handleLanguageToggle(lang)}
                />
              )}
            </Badge>
          ))}
        </div>

        {/* Language Selection Area */}
        <Card className='p-6'>
          <div className='flex items-center gap-2 mb-6'>
            <Music className='h-5 w-5 text-primary' />
            <h2 className='text-xl font-semibold'>Choose Your Music Languages</h2>
          </div>

          <ScrollArea className='h-[450px] pr-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              {validLangs.map((lang) => (
                <TooltipProvider key={lang}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                          selectedLangs.has(lang)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handleLanguageToggle(lang)}
                      >
                        <div className='flex items-center justify-between p-4'>
                          <span className='capitalize font-medium'>{lang}</span>
                          {selectedLangs.has(lang) && (
                            <Check className='h-5 w-5 animate-in fade-in' />
                          )}
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to {selectedLangs.has(lang) ? 'remove' : 'add'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row justify-center gap-4'>
          <Button variant='outline' onClick={handleSkip} className='sm:w-32'>
            Skip
          </Button>
          <Button onClick={handleContinue} className='sm:w-32'>
            Continue
          </Button>
        </div>

        {/* Alert */}
        {showAlert && (
          <Alert className='fixed bottom-4 right-4 w-auto animate-in slide-in-from-bottom-4'>
            <AlertDescription>Preferences reset to Hindi</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default LanguagePreference;
