import { useNavigate } from 'react-router-dom';
import LazyImage from './LazyImage';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 text-center'>
      <div className='flex flex-col md:flex-row items-center justify-center max-w-5xl'>
        <div className='flex-1 mb-6 md:mb-0 md:pr-8 flex flex-col items-center md:items-start'>
          <h1 className='text-4xl font-bold'>SyncVibe</h1>

          <p className='text-lg text-gray-600 mb-6 max-w-md text-justify'>
            Oops! Looks like the page you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate('/')}
            className='px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition'
          >
            Go to Home
          </button>
        </div>
        <div className='flex-1 mt-6 md:mt-0 flex items-center justify-center'>
          <LazyImage
            src='https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_350,w_350/r_max/f_auto/v1733464694/gskejxkelvcp7qputdin.webp'
            alt='SyncVibe'
            aspectRatio='1:1'
            height='350px'
            width='350px'
            className='rounded-lg shadow-lg'
          />
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
