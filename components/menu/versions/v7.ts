import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v7: scene one of the sequenced opening. The menu starts collapsed (the sidebar is its 96px width, the navigation and the mode switch are not shown, and the logo is cropped to its mark), the
// logomark is white on the dark, and it comes in with the card entrance preset (fades in, rises 24px and scales up from 95%, 300ms). Nothing else in the menu animates.
const v2i = v2.interaction!;

export const v7: MotionVersion = {
  ...v2,
  id: 'v7',
  label: 'Scene 1: only the logomark, card entrance',
  layers: { 'logo-mark': { preset: 'card' } },
  interaction: {
    ...v2i,
    initial: 'collapsed',
    layers: {
      ...v2i.layers!,
      // the sidebar button and the mode switch are not shown in the collapsed menu of this scene
      actions: {
        states: { open: { opacity: 1 }, collapsed: { opacity: 0 } },
        transitions: { open: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' }, collapsed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' } },
      },
      // the crop that leaves the mark reaches 32px above and below the logo (v2's reaches 16px), so the card preset's 24px rise is not clipped at the bottom as the mark comes in
      logo: {
        states: { open: { clipPath: 'inset(-32px 0px -32px 0px)' }, collapsed: { clipPath: 'inset(-32px 133px -32px 0px)' } },
        transitions: v2i.layers!.logo!.transitions,
      },
      // white on the dark while the menu is collapsed (the logo's own #141414 turned inside out)
      'logo-mark': {
        states: { open: { filter: 'invert(0)' }, collapsed: { filter: 'invert(1) brightness(1.2)' } },
        transitions: { open: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' }, collapsed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' } },
      },
    },
  },
  forkedFrom: 'v2',
};

export default v7;
