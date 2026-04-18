import ReactDOM from 'react-dom/client';

import { App } from '@/sidepanel/App';

import './style.css';

const root = document.getElementById('root');

if (root == null) {
  throw new Error('No se encontro el nodo root del sidepanel.');
}

ReactDOM.createRoot(root).render(<App />);
