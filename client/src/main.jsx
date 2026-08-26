import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

if (import.meta.env.PROD) {
  const script = document.createElement('script');

  script.defer = true;
  script.src = 'https://analytics.thakur.dev/script.js';
  script.setAttribute('data-website-id', '2df31e68-1ed7-4986-93ce-fe393bfdf2c3');

  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
