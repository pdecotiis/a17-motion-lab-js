// What the lab shows when the project has nothing in it yet (a fresh project: the template's samples are deleted and nothing is
// imported). Motion Lab is worked through Claude, which sits in the chat beside the lab's window, so an empty lab says what to ask and
// lets a designer copy a ready-made request. Plain words, no git or code words.

export type EmptyKind = 'components' | 'pages';

/** A request to copy, with a short label for the job it does. */
export interface EmptyPrompt {
  label: string;
  text: string;
}

export interface EmptyState {
  title: string;
  lead: string;
  prompts: EmptyPrompt[];
  tip: string;
}

// Each request does a different job: bring a design in, start from a whole page, or learn how it works. A frame is picked the same way
// everywhere (a pasted link: Claude reads Figma by link, not by what is selected), so that is said inside the request, not as a separate one.
export const EMPTY_STATES: Record<EmptyKind, EmptyState> = {
  components: {
    title: 'Nothing in the lab yet',
    lead: 'Motion Lab works through Claude. Ask in the chat beside this window, in your own words. Three ways to start:',
    prompts: [
      { label: 'Bring in a design', text: 'Import my Figma frame as a component. Here is the link to the frame (in Figma, select it and press ⌘L): (paste it here)' },
      { label: 'Start from a whole page', text: 'Import a whole Figma page as components and a page together. Here is the link to the frame (in Figma, select it and press ⌘L): (paste it here)' },
      { label: 'Learn how it works', text: 'Walk me through how Motion Lab works, using a small example I can try.' },
    ],
    tip: 'Select a frame in Figma first so Claude can see it. Nothing is changed in your Figma file.',
  },
  pages: {
    title: 'No pages yet',
    lead: 'A page puts your components in order, so you can review the motion of a whole page. Ask Claude in the chat beside this window. Three ways to start:',
    prompts: [
      { label: 'Bring in a design', text: 'Import my Figma page as a page, with its sections as components. Here is the link to the frame (in Figma, select it and press ⌘L): (paste it here)' },
      { label: 'Use what is already here', text: 'Make a page from the components that are already in the lab, in this order: (list them)' },
      { label: 'Learn how it works', text: 'Explain how a page, its versions and Compare work, using a small example I can try.' },
    ],
    tip: 'A page is made of components, so its sections are imported first; Claude does that as part of the page.',
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

  for (const { label, text } of state.prompts) {
    const item = document.createElement('li');
    item.className = 'lab-ask__prompt';
    const words = document.createElement('div');
    words.className = 'lab-ask__words';
    const what = document.createElement('p');
    what.className = 'lab-ask__label';
    what.textContent = label;
    const request = document.createElement('p');
    request.className = 'lab-ask__text';
    request.textContent = text;
    words.append(what, request);
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
