// What the lab shows when the project has nothing in it yet (a fresh project: the template's samples are deleted and nothing is
// imported). Motion Lab is worked through Claude, which sits in the chat beside the lab's window, so an empty lab says what to ask and
// lets a designer copy a ready-made request. Plain words, no git or code words.

export type EmptyKind = 'components' | 'pages';

export interface EmptyState {
  title: string;
  lead: string;
  prompts: string[];
  tip: string;
}

export const EMPTY_STATES: Record<EmptyKind, EmptyState> = {
  components: {
    title: 'Nothing in the lab yet',
    lead: 'Motion Lab works through Claude. Ask in the chat beside this window, in your own words. A few ways to start:',
    prompts: [
      'Import the Figma frame I have selected as a component.',
      'Import this Figma frame as a component: (paste the link here)',
      'Show me what Motion Lab can do and what I should try first.',
    ],
    tip: 'Select a frame in Figma first so Claude can see it. Nothing is changed in your Figma file.',
  },
  pages: {
    title: 'No pages yet',
    lead: 'A page puts your components in order, so you can review the motion of a whole page. Ask Claude:',
    prompts: [
      'Import the Figma page frame I have selected as a page.',
      'Make a page from the components that are already in the lab.',
    ],
    tip: 'A page is made of components, so import the page\'s sections first; Claude can do that as part of the page.',
  },
};

/** Copy text to the clipboard; resolves true when it worked (a browser may refuse without permission). */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Fill `container` with the empty state for `kind`. */
export function renderEmptyState(container: HTMLElement, kind: EmptyKind): void {
  const state = EMPTY_STATES[kind];
  container.replaceChildren();
  container.className = 'lab-main lab-main--empty';

  const wrap = document.createElement('section');
  wrap.className = 'lab-ask';
  wrap.setAttribute('aria-labelledby', 'lab-ask-title');
  const title = document.createElement('h2');
  title.className = 'lab-ask__title';
  title.id = 'lab-ask-title';
  title.textContent = state.title;
  const lead = document.createElement('p');
  lead.className = 'lab-ask__lead';
  lead.textContent = state.lead;
  const list = document.createElement('ul');
  list.className = 'lab-ask__prompts';

  for (const text of state.prompts) {
    const item = document.createElement('li');
    item.className = 'lab-ask__prompt';
    const words = document.createElement('p');
    words.className = 'lab-ask__text';
    words.textContent = text;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lab-btn lab-btn--sm lab-ask__copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', `Copy: ${text}`);
    button.addEventListener('click', () => {
      void copy(text).then(ok => {
        button.textContent = ok ? 'Copied' : 'Select and copy';
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1800);
      });
    });
    item.append(words, button);
    list.appendChild(item);
  }

  const tip = document.createElement('p');
  tip.className = 'lab-ask__tip';
  tip.textContent = state.tip;
  wrap.append(title, lead, list, tip);
  container.appendChild(wrap);
}
