import { useRef } from 'react';
import { LaptopRoom, PhoneRoom, useDemoRoom } from '@/components/LandingPage/RoomDemo';

/** The app itself instead of a stock photo: the same live room as the landing page. */
const AuthShowcase = () => {
  const stageRef = useRef(null);
  const room = useDemoRoom(stageRef);

  return (
    <div ref={stageRef} className='absolute inset-0 isolate overflow-hidden bg-card'>
      <img
        src={room.song.cover}
        alt=''
        className='absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-30 blur-3xl'
      />
      <div className='p-8 xl:p-12'>
        <p className='font-display text-[clamp(2.25rem,3.6vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em] [font-variation-settings:"wdth"_100]'>
          Same song.
          <br />
          Same second.
        </p>
        <p className='mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground'>
          Start a room and hear every beat at the same moment as your friends, wherever they are.
        </p>
      </div>

      <LaptopRoom room={room} className='absolute! top-[32%] left-[25%] w-[92%]!' />
      <PhoneRoom room={room} source='phone' className='absolute! bottom-6 left-6 w-[22%]!' />
    </div>
  );
};

export default AuthShowcase;
