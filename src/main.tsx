
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';

import outputs from '../amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';

import App from './App';

// Configure AWS Amplify before rendering the application.
Amplify.configure(outputs);

// Find the root element defined in index.html.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found in index.html');
}

// Mount the React application.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
