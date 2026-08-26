export const TimeAgo = (postedTime: string | number | Date): string => {
  const postedDate = new Date(postedTime);
  const currentDate = new Date();
  const elapsed: number = currentDate.getTime() - postedDate.getTime();

  // Calculate time differences
  const seconds: number = Math.floor(elapsed / 1000);
  const minutes: number = Math.floor(seconds / 60);
  const hours: number = Math.floor(minutes / 60);

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
  const day: string = String(postedDate.getDate()).padStart(2, '0');
  const month: string = postedDate.toLocaleString('en-US', { month: 'short' }); // e.g., "Dec"
  const year: number = postedDate.getFullYear();

  const formattedDate: string = `${day} ${month} ${year}`;
  const formattedTime: string = postedDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${formattedDate}`;
};
