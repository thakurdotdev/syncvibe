import React from 'react';
import { formatMessageDate } from './ChatDateUtils';

const DateSeparator = ({ date }) => (
  <div className='flex justify-center my-4'>
    <span className='text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full font-medium shadow-xs'>
      {formatMessageDate(date)}
    </span>
  </div>
);

export default DateSeparator;
