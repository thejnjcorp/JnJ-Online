import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.scss';
import App from './components/App';
import reportWebVitals from './reportWebVitals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyAccessibility, loadCachedSettings } from './utils/accessibility';

// Before the first paint, so reading settings never flash the default look.
applyAccessibility(loadCachedSettings());

const root = ReactDOM.createRoot(document.getElementById('root'));
const queryClient = new QueryClient();

root.render(
  <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
