import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './lib/auth.jsx';
import App from './App.jsx';
import SitterShareView from './pages/SitterShareView.jsx';
import { parseRoute } from './lib/route.js';

const route = parseRoute(window.location.pathname);
const root = ReactDOM.createRoot(document.getElementById('root'));

if (route.mode === 'share-sitter') {
  root.render(
    <React.StrictMode>
      <SitterShareView token={route.token} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}
