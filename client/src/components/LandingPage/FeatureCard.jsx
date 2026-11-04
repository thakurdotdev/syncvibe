const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className='relative group'>
    <div className='absolute -inset-px bg-linear-to-b from-foreground/50 to-foreground/50 rounded-xl opacity-0 group-hover:opacity-100 blur-sm transition duration-1000' />
    <div className='relative p-8 bg-on-scrim/5 backdrop-blur-xl rounded-xl border border-on-scrim/10 transition-colors'>
      <div className='p-3 rounded-full bg-linear-to-r from-foreground/20 to-foreground/20 w-fit'>
        <Icon className='w-6 h-6 text-foreground' />
      </div>
      <h3 className='text-xl font-semibold text-foreground mt-4 mb-2'>{title}</h3>
      <p className='text-muted-foreground'>{description}</p>
    </div>
  </div>
);

export default FeatureCard;
