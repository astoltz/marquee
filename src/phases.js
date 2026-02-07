// Animation phase implementations
//
// Each phase factory returns { start(), update(dt), getState() }
// - start(): initialize phase state
// - update(dt): advance by dt milliseconds, return true when done
// - getState(): return current render state

import { EASINGS } from './defaults.js';
import { resolveColors } from './colors.js';
import { resolveTokens } from './tokens.js';

/**
 * Create a phase instance from a step config.
 */
export function createPhase(step, containerWidth, textWidth, prevState, presetColors, tokenContext) {
  let type = step.phase || 'pause';

  // 'random' picks a random animation phase
  if (type === 'random') {
    const choices = ['scroll-left', 'scroll-right', 'flash', 'fade-in', 'fade-out', 'wipe-in', 'float-up', 'float-down'];
    type = choices[Math.floor(Math.random() * choices.length)];
  }

  // Resolve tokens in step text
  if (step.text && tokenContext) {
    step = { ...step, text: resolveTokens(step.text, tokenContext) };
  }

  const factory = PHASE_REGISTRY[type];
  if (!factory) throw new Error(`Unknown phase: ${type}`);
  const phase = factory(step, containerWidth, textWidth, prevState, presetColors);

  // For liveTokens, wrap update to re-resolve tokens each frame
  if (step.liveTokens && tokenContext) {
    const originalUpdate = phase.update.bind(phase);
    const originalGetState = phase.getState.bind(phase);
    phase.update = (dt) => {
      const done = originalUpdate(dt);
      const state = originalGetState();
      state.text = resolveTokens(step.text, tokenContext);
      return done;
    };
  }

  return phase;
}

/**
 * Register a custom phase type.
 */
export function registerPhase(name, factory) {
  PHASE_REGISTRY[name] = factory;
}

// Internal state shape that all phases produce:
// { text, offsetX, offsetY, opacity, visible, colors, progress }

function makeState(step, prevState) {
  return {
    text: step.text || (prevState && prevState.text) || '',
    offsetX: (prevState && prevState.offsetX) || 0,
    offsetY: (prevState && prevState.offsetY) || 0,
    opacity: 1,
    visible: true,
    colors: [],
    progress: 0,
    stripeDirection: step.stripeDirection || (prevState && prevState.stripeDirection) || undefined,
  };
}

function resolveEasing(name) {
  return EASINGS[name] || EASINGS['linear'];
}

// --- Phase factories ---

function createScrollPhase(direction) {
  return (step, containerWidth, textWidth, prevState, presetColors) => {
    const speed = step.speed || 120; // px per second
    const until = step.until || 'offscreen';
    const easing = resolveEasing(step.easing);
    const state = makeState(step, prevState);
    let elapsed = 0;

    // If this step introduces NEW text, always start from off-screen
    const hasNewText = step.text && (!prevState || prevState.text !== step.text);

    if (hasNewText) {
      state.offsetX = direction === 'left' ? containerWidth : -textWidth;
      state.offsetY = 0;
    } else if (!prevState) {
      state.offsetX = direction === 'left' ? containerWidth : -textWidth;
    }

    // Target position
    let targetX;
    if (until === 'center') {
      targetX = (containerWidth - textWidth) / 2;
    } else if (until === 'offscreen') {
      targetX = direction === 'left' ? -textWidth : containerWidth;
    } else if (typeof until === 'number') {
      targetX = until;
    } else {
      targetX = direction === 'left' ? -textWidth : containerWidth;
    }

    const startX = state.offsetX;
    const totalDist = Math.abs(targetX - startX);
    const totalTime = (totalDist / speed) * 1000; // ms

    return {
      start() {
        elapsed = 0;
        state.colors = resolveColors(step.color, state.text, 0, presetColors);
      },
      update(dt) {
        elapsed += dt;
        const rawProgress = totalTime > 0 ? Math.min(elapsed / totalTime, 1) : 1;
        state.progress = rawProgress;
        const easedProgress = easing(rawProgress);
        state.offsetX = startX + (targetX - startX) * easedProgress;
        state.colors = resolveColors(step.color, state.text, rawProgress, presetColors);
        return rawProgress >= 1;
      },
      getState() { return state; },
    };
  };
}

function createFlashPhase(step, containerWidth, textWidth, prevState, presetColors) {
  const times = step.times || 3;
  const interval = step.interval || 300;
  const state = makeState(step, prevState);
  let elapsed = 0;
  let toggleCount = 0;
  const totalToggles = times * 2; // on/off pairs

  // If new text, center it
  if (step.text && (!prevState || prevState.text !== step.text)) {
    state.offsetX = (containerWidth - textWidth) / 2;
    state.offsetY = 0;
  }

  return {
    start() {
      elapsed = 0;
      toggleCount = 0;
      state.visible = true;
      state.colors = resolveColors(step.color, state.text, 0, presetColors);
    },
    update(dt) {
      elapsed += dt;
      const newToggleCount = Math.floor(elapsed / interval);
      if (newToggleCount > toggleCount) {
        toggleCount = newToggleCount;
        state.visible = toggleCount % 2 === 0;
      }
      state.progress = Math.min(toggleCount / totalToggles, 1);
      state.colors = resolveColors(step.color, state.text, state.progress, presetColors);
      return toggleCount >= totalToggles;
    },
    getState() { return state; },
  };
}

function createPausePhase(step, containerWidth, textWidth, prevState, presetColors) {
  const duration = step.duration || 1000;
  const state = makeState(step, prevState);
  let elapsed = 0;

  // If new text, center it
  if (step.text && (!prevState || prevState.text !== step.text)) {
    state.offsetX = (containerWidth - textWidth) / 2;
    state.offsetY = 0;
  }

  return {
    start() {
      elapsed = 0;
      state.colors = resolveColors(step.color, state.text, 0, presetColors);
    },
    update(dt) {
      elapsed += dt;
      state.progress = Math.min(elapsed / duration, 1);
      return elapsed >= duration;
    },
    getState() { return state; },
  };
}

function createFloatPhase(direction) {
  return (step, containerWidth, textWidth, prevState, presetColors) => {
    const duration = step.duration || 800;
    const distance = step.distance || 60;
    const easing = resolveEasing(step.easing || 'ease-out');
    const state = makeState(step, prevState);

    // If new text, center it
    if (step.text && (!prevState || prevState.text !== step.text)) {
      state.offsetX = (containerWidth - textWidth) / 2;
      state.offsetY = 0;
    }

    const startY = state.offsetY;
    let elapsed = 0;

    return {
      start() {
        elapsed = 0;
        state.colors = resolveColors(step.color, state.text, 0, presetColors);
      },
      update(dt) {
        elapsed += dt;
        const rawProgress = Math.min(elapsed / duration, 1);
        state.progress = rawProgress;
        const easedProgress = easing(rawProgress);

        if (direction === 'up') {
          state.offsetY = startY - distance * easedProgress;
        } else {
          state.offsetY = startY + distance * easedProgress;
        }

        state.colors = resolveColors(step.color, state.text, rawProgress, presetColors);
        return rawProgress >= 1;
      },
      getState() { return state; },
    };
  };
}

function createFadePhase(direction) {
  return (step, containerWidth, textWidth, prevState, presetColors) => {
    const duration = step.duration || 600;
    const easing = resolveEasing(step.easing || 'ease-in-out');
    const state = makeState(step, prevState);
    let elapsed = 0;

    // fade-in starts at 0, fade-out starts at 1
    const startOpacity = direction === 'in' ? 0 : 1;
    const endOpacity = direction === 'in' ? 1 : 0;

    // If new text with fade-in, center it
    if (direction === 'in' && step.text && (!prevState || prevState.text !== step.text)) {
      state.offsetX = (containerWidth - textWidth) / 2;
      state.offsetY = 0;
    }

    return {
      start() {
        elapsed = 0;
        state.opacity = startOpacity;
        state.colors = resolveColors(step.color, state.text, 0, presetColors);
      },
      update(dt) {
        elapsed += dt;
        const rawProgress = Math.min(elapsed / duration, 1);
        state.progress = rawProgress;
        const easedProgress = easing(rawProgress);
        state.opacity = startOpacity + (endOpacity - startOpacity) * easedProgress;
        state.colors = resolveColors(step.color, state.text, rawProgress, presetColors);
        return rawProgress >= 1;
      },
      getState() { return state; },
    };
  };
}

function createWipePhase(direction) {
  return (step, containerWidth, textWidth, prevState, presetColors) => {
    const duration = step.duration || 800;
    const easing = resolveEasing(step.easing || 'linear');
    const state = makeState(step, prevState);
    let elapsed = 0;

    // If new text with wipe-in, center it
    if (direction === 'in' && step.text && (!prevState || prevState.text !== step.text)) {
      state.offsetX = (containerWidth - textWidth) / 2;
      state.offsetY = 0;
    }

    return {
      start() {
        elapsed = 0;
        state.colors = resolveColors(step.color, state.text, 0, presetColors);
        state.wipeProgress = direction === 'in' ? 0 : 1;
      },
      update(dt) {
        elapsed += dt;
        const rawProgress = Math.min(elapsed / duration, 1);
        state.progress = rawProgress;
        const easedProgress = easing(rawProgress);
        state.wipeProgress = direction === 'in' ? easedProgress : 1 - easedProgress;
        state.colors = resolveColors(step.color, state.text, rawProgress, presetColors);
        return rawProgress >= 1;
      },
      getState() { return state; },
    };
  };
}

// 'slide-in' / 'slide-out' — text slides in from the side and stops, or slides out
function createSlidePhase(direction) {
  return (step, containerWidth, textWidth, prevState, presetColors) => {
    const duration = step.duration || 600;
    const from = step.from || (direction === 'in' ? 'right' : 'left');
    const easing = resolveEasing(step.easing || 'ease-out');
    const state = makeState(step, prevState);
    let elapsed = 0;

    const centerX = (containerWidth - textWidth) / 2;
    let startX, targetX;

    if (direction === 'in') {
      startX = from === 'right' ? containerWidth : -textWidth;
      targetX = centerX;
      state.offsetX = startX;
      state.offsetY = 0;
    } else {
      startX = prevState ? prevState.offsetX : centerX;
      targetX = from === 'right' ? containerWidth : -textWidth;
    }

    return {
      start() {
        elapsed = 0;
        state.colors = resolveColors(step.color, state.text, 0, presetColors);
      },
      update(dt) {
        elapsed += dt;
        const rawProgress = Math.min(elapsed / duration, 1);
        state.progress = rawProgress;
        const easedProgress = easing(rawProgress);
        state.offsetX = startX + (targetX - startX) * easedProgress;
        state.colors = resolveColors(step.color, state.text, rawProgress, presetColors);
        return rawProgress >= 1;
      },
      getState() { return state; },
    };
  };
}

// 'split-flap' — sets text on state, renderer handles the per-character flip animation
function createSplitFlapPhase(step, containerWidth, textWidth, prevState, presetColors) {
  const duration = step.duration || 3000;
  const state = makeState(step, prevState);
  state.splitFlap = true;
  // Center text
  state.offsetX = (containerWidth - textWidth) / 2;
  state.offsetY = 0;
  let elapsed = 0;

  return {
    start() {
      elapsed = 0;
      state.colors = resolveColors(step.color || '#e8e8d0', state.text, 0, presetColors);
    },
    update(dt) {
      elapsed += dt;
      state.progress = Math.min(elapsed / duration, 1);
      return elapsed >= duration;
    },
    getState() { return state; },
  };
}

// --- Phase registry ---

const PHASE_REGISTRY = {
  'scroll-left': createScrollPhase('left'),
  'scroll-right': createScrollPhase('right'),
  'flash': createFlashPhase,
  'pause': createPausePhase,
  'float-up': createFloatPhase('up'),
  'float-down': createFloatPhase('down'),
  'fade-in': createFadePhase('in'),
  'fade-out': createFadePhase('out'),
  'wipe-in': createWipePhase('in'),
  'wipe-out': createWipePhase('out'),
  'slide-in': createSlidePhase('in'),
  'slide-out': createSlidePhase('out'),
  'split-flap': createSplitFlapPhase,
};

export { PHASE_REGISTRY };
