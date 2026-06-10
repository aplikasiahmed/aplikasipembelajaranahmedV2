import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Wajib ada agar Tailwind berfungsi

// Intercept Google OAuth Popup callback
if (window.opener && (window.location.hash.includes('access_token') || window.location.search.includes('access_token'))) {
  const hash = window.location.hash || window.location.search;
  const cleanHash = hash.startsWith('#') ? hash.substring(1) : (hash.startsWith('?') ? hash.substring(1) : hash);
  const params = new URLSearchParams(cleanHash);
  const token = params.get('access_token');
  if (token) {
    window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', token }, '*');
    window.close();
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);