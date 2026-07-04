// @ts-nocheck
const targetsByType = new Map();
const DRAG_THRESHOLD = 4;
const AUTO_SCROLL_EDGE = 64;
const AUTO_SCROLL_MAX_SPEED = 14;

function targetRegistry(type = "default") {
  if (!targetsByType.has(type)) {
    targetsByType.set(type, new Map());
  }
  return targetsByType.get(type);
}

function restoreBodySelection(previousUserSelect) {
  document.body.style.userSelect = previousUserSelect;
}

function nearestScrollableParent(node) {
  let current = node.parentElement;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const canScroll = /(auto|scroll)/.test(`${style.overflowY}${style.overflow}`);
    if (canScroll && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function autoScrollNearEdge(clientY, scrollContainer) {
  if (!scrollContainer) return;
  const isDocument = scrollContainer === document.scrollingElement || scrollContainer === document.documentElement;
  const rect = isDocument
    ? { top: 0, bottom: window.innerHeight }
    : scrollContainer.getBoundingClientRect();
  const topDistance = clientY - rect.top;
  const bottomDistance = rect.bottom - clientY;
  let delta = 0;

  if (topDistance < AUTO_SCROLL_EDGE) {
    delta = -Math.ceil(((AUTO_SCROLL_EDGE - topDistance) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED);
  } else if (bottomDistance < AUTO_SCROLL_EDGE) {
    delta = Math.ceil(((AUTO_SCROLL_EDGE - bottomDistance) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED);
  }

  if (delta !== 0) {
    scrollContainer.scrollTop += delta;
  }
}

export function dropPositionFromPoint(clientY, node) {
  const rect = node.getBoundingClientRect();
  return clientY >= rect.top + rect.height / 2 ? "after" : "before";
}

export function sortableDragHandle(node, options = {}) {
  let config = options;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let currentTarget = null;
  let previousUserSelect = "";
  let scrollContainer = null;

  function findTarget(event) {
    const registry = targetRegistry(config.type);
    const elements = document.elementsFromPoint?.(event.clientX, event.clientY) || [];
    for (const element of elements) {
      for (const [id, target] of registry) {
        if (target.node === element || target.node.contains(element)) {
          return { id, ...target };
        }
      }
    }
    return null;
  }

  function leaveCurrent(event) {
    if (!currentTarget) return;
    currentTarget.config.onLeave?.({ id: currentTarget.id, event });
    currentTarget = null;
  }

  function startDrag(event) {
    dragging = true;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    scrollContainer = nearestScrollableParent(node);
    node.setPointerCapture?.(event.pointerId);
    config.onStart?.({ id: config.id, event });
  }

  function handlePointerDown(event) {
    if (config.disabled || event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    currentTarget = null;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (event.pointerId !== pointerId) return;
    const distance = Math.max(Math.abs(event.clientX - startX), Math.abs(event.clientY - startY));
    if (!dragging && distance >= DRAG_THRESHOLD) {
      startDrag(event);
    }
    if (!dragging) return;
    autoScrollNearEdge(event.clientY, scrollContainer);

    const target = findTarget(event);
    if (!target || target.id === config.id) {
      leaveCurrent(event);
      return;
    }

    const position = dropPositionFromPoint(event.clientY, target.node);
    if (currentTarget?.id !== target.id) {
      leaveCurrent(event);
      currentTarget = target;
    }
    target.config.onOver?.({ id: target.id, position, event });
  }

  function cleanup(event) {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    node.releasePointerCapture?.(pointerId);
    pointerId = null;
    if (dragging) {
      config.onEnd?.({ id: config.id, event });
      restoreBodySelection(previousUserSelect);
    }
    dragging = false;
    currentTarget = null;
    scrollContainer = null;
  }

  function handlePointerUp(event) {
    if (event.pointerId !== pointerId) return;
    if (dragging && currentTarget && currentTarget.id !== config.id) {
      currentTarget.config.onDrop?.({
        sourceId: config.id,
        targetId: currentTarget.id,
        position: dropPositionFromPoint(event.clientY, currentTarget.node),
        event
      });
    }
    cleanup(event);
  }

  function handlePointerCancel(event) {
    if (event.pointerId !== pointerId) return;
    if (dragging) {
      leaveCurrent(event);
    }
    cleanup(event);
  }

  node.addEventListener("pointerdown", handlePointerDown);

  return {
    update(nextOptions = {}) {
      config = nextOptions;
    },
    destroy() {
      node.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (dragging) {
        restoreBodySelection(previousUserSelect);
      }
    }
  };
}

export function sortableDropTarget(node, options = {}) {
  let config = options;
  let registry = targetRegistry(config.type);

  function syncRegistry() {
    registry.delete(config.id);
    registry = targetRegistry(config.type);
    registry.set(config.id, { node, config });
  }

  syncRegistry();

  return {
    update(nextOptions = {}) {
      registry.delete(config.id);
      config = nextOptions;
      syncRegistry();
    },
    destroy() {
      registry.delete(config.id);
    }
  };
}
