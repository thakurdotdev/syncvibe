export const TimeAgo = (postedTime) => {
  const postedDate = new Date(postedTime);
  const currentDate = new Date();
  const elapsed = currentDate - postedDate;

  // Calculate time differences
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  // Less than 1 minute ago
  if (elapsed < 60000) {
    return 'Just now';
  }

  // Less than 24 hours ago
  if (elapsed < 86400000) {
    if (hours > 0) {
      return `${hours}h ago`;
    }
    return `${minutes}min ago`;
  }

  // More than 24 hours ago: Format as `DD Mon YYYY, HH:MM AM/PM`
  const day = String(postedDate.getDate()).padStart(2, '0');
  const month = postedDate.toLocaleString('en-US', { month: 'short' }); // e.g., "Dec"
  const year = postedDate.getFullYear();

  const formattedDate = `${day} ${month} ${year}`;
  const formattedTime = postedDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${formattedDate}`;
};
