import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
import { watchScramble } from '../card-feature/scramble.js';
import { v1 } from './versions/v1.js';
import { v2 } from './versions/v2.js';
import { v3 } from './versions/v3.js';
import { v4 } from './versions/v4.js';
import { v5 } from './versions/v5.js';

// One file per version in ./versions/. Add new versions there and list them here.
export { v1, v2, v3, v4, v5 };
export const versions: MotionVersion[] = [v1, v2, v3, v4, v5];
export const defaultVersion = 'v1';

watchScramble();   // the eyebrow's scramble (the same as the feature card's: see ../card-feature/scramble.ts)

const module: ComponentModule = { versions, defaultVersion };
export default module;
