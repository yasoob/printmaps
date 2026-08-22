import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import { App } from './app/App';

ReactDOM.createRoot(document.querySelector('#root')!).render(<App />);
