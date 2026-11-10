const sameDay = (a, b) => a.toDateString() === b.toDateString();

const yesterdayOf = (date) => {
  const day = new Date(date);
  day.setDate(day.getDate() - 1);
  return day;
};

export const formatFullDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatMessageDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterdayOf(today))) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

/** For the conversation list: the time today, "Yesterday", then the date. */
export const formatListTime = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  if (sameDay(date, today)) return formatTime(date);
  if (sameDay(date, yesterdayOf(today))) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const dayKey = (dateString) => new Date(dateString).toDateString();

export const formatCallDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
