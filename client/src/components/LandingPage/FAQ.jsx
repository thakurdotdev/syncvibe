import { Plus } from 'lucide-react';
import { memo } from 'react';

const FAQS = [
  {
    question: 'How does listening together work?',
    answer:
      'Everyone in a room follows the same player. When someone plays, pauses, skips, or moves through a song, every other device follows, and SyncVibe keeps correcting for each connection so nobody drifts.',
  },
  {
    question: 'Do my friends need the app or a Pro plan?',
    answer:
      'No. They can join from a browser or the Android app, on any plan. Room limits come from the plan of the person who created the room.',
  },
  {
    question: 'Is there an iPhone app?',
    answer: 'Not yet. On an iPhone, open SyncVibe in your browser to listen and join rooms.',
  },
  {
    question: 'What does Pro add?',
    answer:
      'Rooms with up to 10 listeners and 50 queued songs, room chat with GIFs and sound clips, a Pro badge, and priority support. It costs ₹299 a year.',
  },
  {
    question: 'Can I use SyncVibe on my own?',
    answer:
      'Yes. Stream music, build playlists, and pick up from your history without ever opening a room.',
  },
];

const FAQ = memo(() => (
  <section id='faq' className='scroll-mt-24 py-14 sm:py-20'>
    <div className='mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'>
      <h2 className='section-title'>Questions, answered.</h2>
      <div className='border-t border-border'>
        {FAQS.map(({ question, answer }) => (
          <details key={question} className='group border-b border-border'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold sm:text-lg [&::-webkit-details-marker]:hidden'>
              {question}
              <Plus
                size={18}
                aria-hidden='true'
                className='shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45'
              />
            </summary>
            <p className='max-w-[65ch] pb-5 text-sm leading-relaxed text-muted-foreground sm:text-base'>
              {answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
));

FAQ.displayName = 'FAQ';
export default FAQ;
