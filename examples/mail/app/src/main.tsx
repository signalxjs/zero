import { render } from 'sigx';
import '@sigx/zero/css';
import '@sigx/zero-mail-ds/css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { installThemes } from '@sigx/zero-mail-ds';
import { App } from './App';

installThemes();
render(<App />, document.getElementById('app')!);
