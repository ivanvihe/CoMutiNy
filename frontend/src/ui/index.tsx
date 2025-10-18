import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MultiplayerClient } from '../multiplayer';
import { GameUi } from './GameUi';

let reactRoot: Root | null = null;

export function registerUi(root: HTMLElement, multiplayer?: MultiplayerClient): void {
  const overlay = ensureOverlay(root);

  if (!reactRoot) {
    reactRoot = createRoot(overlay);
  }

  overlay.removeAttribute('aria-hidden');

  reactRoot.render(
    <StrictMode>
      <GameUi multiplayer={multiplayer} />
    </StrictMode>,
  );
}

function ensureOverlay(root: HTMLElement): HTMLElement {
  const existing = root.querySelector<HTMLElement>('#ui-overlay');
  if (existing) {
    return existing;
  }
  const overlay = document.createElement('div');
  overlay.id = 'ui-overlay';
  overlay.className = 'game-shell__overlay';
  root.appendChild(overlay);
  return overlay;
}
