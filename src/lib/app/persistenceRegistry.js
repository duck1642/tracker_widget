// @ts-nocheck
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.js";

function controllersFor(documents) {
  return [...new Set([...documents].map((document) => document.persistence).filter(Boolean))];
}

function succeeded(result) {
  return typeof result === "boolean" ? result : documentSucceeded(result);
}

function stateOf(controller) {
  return typeof controller?.state === "function" ? controller.state() : controller?.state || {};
}

export function blockedSaveMessage(action, documents) {
  return [...documents].some((document) => stateOf(document.persistence).conflict ?? document.conflict)
    ? `Resolve file conflicts before ${action}`
    : `Save failed. Retry saving before ${action}`;
}

export class PersistenceRegistry {
  constructor() {
    this.documents = new Set();
  }

  register(document) {
    this.documents.add(document);
    return () => this.documents.delete(document);
  }

  cancelPendingOpens() {
    for (const controller of controllersFor(this.documents)) controller.cancelOpen?.();
  }

  async flushAll({ isCurrent = () => true } = {}) {
    const documents = [...this.documents];
    const controllers = controllersFor(documents);

    for (;;) {
      if (!isCurrent()) return false;
      const actualTasks = documents.map((document) => document.actualTask);
      // Stores with derived work (such as the weekly actuals refresh) must
      // settle it before the controller drain inspects each final draft.
      for (const document of documents) {
        if (!isCurrent()) return false;
        if (typeof document.flushSave === "function") {
          const result = await document.flushSave();
          if (!succeeded(result) || !isCurrent()) return false;
        }
      }
      if (documents.some((document, index) => document.actualTask !== actualTasks[index])) continue;

      const result = await DocumentController.flushAll(controllers, { isCurrent });
      if (!succeeded(result) || !isCurrent()) return false;

      // A derived task can queue a new draft while the previous snapshot drains.
      // Recheck task identities and the complete registry before allowing shutdown.
      const tasksChanged = documents.some((document, index) => document.actualTask !== actualTasks[index]);
      const unsettled = documents.some((document) => document.dirty || document.saving)
        || controllers.some((controller) => {
          const state = stateOf(controller);
          return state.dirty || state.saving;
        });
      if (!tasksChanged && !unsettled) return true;
    }
  }

  blockedMessage(action) {
    return blockedSaveMessage(action, this.documents);
  }
}

export const persistenceRegistry = new PersistenceRegistry();
