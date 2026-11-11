import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
import { v1 } from './versions/v1.js';
import { watchDotFields } from './pattern/start.js';

// The pattern is code, not markup: this starts the dot fields wherever the lab puts one on screen.
watchDotFields();

// One file per version in ./versions/. Add new versions there and list them here.
export { v1 };
export const versions: MotionVersion[] = [v1];
export const defaultVersion = 'v1';

const module: ComponentModule = { versions, defaultVersion };
export default module;
