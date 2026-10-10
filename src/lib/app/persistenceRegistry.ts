import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.ts";
import type { CurrentRequest, DocumentConflict, DocumentLifecycle, DocumentResult } from "$lib/shared/persistence/documentController.ts";

export interface RegisteredDocument {
  persistence?: DocumentLifecycle;
  flushSave?: () => Promise<boolean | DocumentResult>;
  actualTask?: Promise<unknown>;
  dirty?: boolean;
  saving?: boolean;
  conflict?: DocumentConflict | null;
}
export interface RegistrySink { register(document: RegisteredDocument): unknown }

function controllersFor(documents: Iterable<RegisteredDocument>) {
  return [...new Set([...documents].map((document) => document.persistence).filter((controller) => controller !== undefined))];
}

function succeeded(result: boolean | DocumentResult) {
  return typeof result === "boolean" ? result : documentSucceeded(result);
}

function stateOf(controller: DocumentLifecycle | undefined) {
  return controller?.state();
}

export function blockedSaveMessage(action: string, documents: Iterable<RegisteredDocument>) {
  return [...documents].some((document) => stateOf(document.persistence)?.conflict ?? document.conflict)
    ? `Resolve file conflicts before ${action}`
    : `Save failed. Retry saving before ${action}`;
}

export class PersistenceRegistry {
  documents: Set<RegisteredDocument>;
  constructor() {
    this.documents = new Set<RegisteredDocument>();
  }

  register(document: RegisteredDocument) {
    this.documents.add(document);
    return () => this.documents.delete(document);
  }

  cancelPendingOpens() {
    for (const controller of controllersFor(this.documents)) controller.cancelOpen?.();
  }

  async flushAll({ isCurrent = () => true }: CurrentRequest = {}) {
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
          return state?.dirty || state?.saving;
        });
      if (!tasksChanged && !unsettled) return true;
    }
  }

  blockedMessage(action: string) {
    return blockedSaveMessage(action, this.documents);
  }
}

export const persistenceRegistry = new PersistenceRegistry();
