import { formatMessageDate } from './ChatDateUtils';

const DateSeparator = ({ date }) => (
  <div className='my-4 flex justify-center'>
    <span className='rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs'>
      {formatMessageDate(date)}
    </span>
  </div>
);

export default DateSeparator;
