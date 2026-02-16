import { render } from 'solid-js/web';
import './index.css'; // Ensure you have your @tailwind directives here
import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found. Did you forget to add it to your index.html?');
}

render(() => <App />, root!);