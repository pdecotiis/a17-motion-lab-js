import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
import { watchScramble } from './scramble.js';
import { v1 } from './versions/v1.js';
import { v3 } from './versions/v3.js';
import { v2 } from './versions/v2.js';
import { v4 } from './versions/v4.js';

// One file per version in ./versions/. Add new versions there and list them here.
export { v1, v2, v3, v4 };
export const versions: MotionVersion[] = [v1, v2, v3, v4];
export const defaultVersion = 'v1';

watchScramble();   // the eyebrow's scramble (see scramble.ts)

const module: ComponentModule = { versions, defaultVersion };
export default module;
