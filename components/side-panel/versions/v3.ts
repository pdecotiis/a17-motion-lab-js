import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v2's open and close, plus the × button responds to the pointer by the `ui` preset (a tint on hover, a scale and a deeper tint on press,
// released a little slower). That is an element of the panel with states of its own: the panel stays open or closed, and the button's
// hover and press never move it between those, nor does the panel opening reset the button.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Open / Close, button preset on the ×',
  interaction: v2.interaction!,
  elements: { close: 'ui' },
  trigger: { on: 'click' },
  forkedFrom: 'v2',
};

export default v3;
