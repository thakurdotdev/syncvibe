const FAQ = () => (
  <section className='py-32 bg-gradient-to-b from-black to-purple-900/20'>
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
      <div className='text-center mb-20'>
        <h2 className='text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6'>
          Frequently Asked Questions
        </h2>
        <p className='text-xl text-white/70 max-w-2xl mx-auto'>
          Find answers to common questions about SyncVibe
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
        <FAQItem
          question='How do I get started with SyncVibe?'
          answer='Getting started with SyncVibe is easy. Simply create an account, either using Google or email, and start syncing with friends.'
        />
        <FAQItem
          question='Can I use SyncVibe on my mobile device?'
          answer='Yes SyncVibe is fully responsive and works seamlessly on mobile devices. You can access it through your mobile browser or download the 
          mobile app.'
        />
        <FAQItem
          question='How do I create a private playlist?'
          answer='To create a private playlist, simply navigate to the playlist section, click on the create playlist button, and add your favorite songs to the playlist. You can then share the playlist with your friends.'
        />
      </div>
    </div>
  </section>
);

const FAQItem = ({ question, answer }) => (
  <div className='bg-white/5 rounded-xl p-8 border border-white/10'>
    <h3 className='text-xl font-semibold text-white mb-4'>{question}</h3>
    <p className='text-white/70'>{answer}</p>
  </div>
);

export default FAQ;
