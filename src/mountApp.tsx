import ReactDOM from 'react-dom/client';
import { App } from './app/App';

export function mountApp() {
  ReactDOM.createRoot(document.querySelector('#root')!).render(<App />);
}
