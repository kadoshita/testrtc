import './styles/global.css';
import { App } from './ui/app.js';

// Register all test implementations (side-effect imports add tests to registry)
import './tests/mictest.js';
import './tests/camresolutionstest.js';
import './tests/nettest.js';
import './tests/conntest.js';
import './tests/bandwidth_test.js';

const appEl = document.getElementById('app')!;
const app = new App();
appEl.appendChild(app.element);
app.init();
