const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="relative group">
    <div className="absolute -inset-px bg-gradient-to-b from-purple-500/50 to-pink-500/50 rounded-xl opacity-0 group-hover:opacity-100 blur transition duration-1000" />
    <div className="relative p-8 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 transition-colors">
      <div className="p-3 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 w-fit">
        <Icon className="w-6 h-6 text-purple-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mt-4 mb-2">{title}</h3>
      <p className="text-white/70">{description}</p>
    </div>
  </div>
);

export default FeatureCard;
