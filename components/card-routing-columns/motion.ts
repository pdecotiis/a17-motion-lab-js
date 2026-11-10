import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
import { v1 } from './versions/v1.js';
import { v2 } from './versions/v2.js';
import { v3 } from './versions/v3.js';

// One file per version in ./versions/. Add new versions there and list them here.
export { v1, v2, v3 };
export const versions: MotionVersion[] = [v1, v2, v3];
export const defaultVersion = 'v1';

const module: ComponentModule = { versions, defaultVersion };
export default module;
