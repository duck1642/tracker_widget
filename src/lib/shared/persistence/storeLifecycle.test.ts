import type { SessionStore } from "$lib/app/types.ts";
import type { FileService } from "./documentController.ts";
import { requireValue } from "$lib/shared/testing/testHelpers.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { DailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { WeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
import { DocumentController } from "./documentController.ts";


type Dependencies = {fileService:FileService;registry:{register():void};appStore:{filePath:string;showStatus(message:string):void;saveConfig():Promise<void>};weekStore:null};
function scenario<S extends SessionStore>(name:string, Store:new(options:Dependencies)=>S, initial:string, external:string, open:(store:S)=>Promise<boolean>, edit:(store:S,text:string)=>void, text:(store:S)=>string) {
  return {name, async harness() {
    let disk = initial;
    const fileService = {pathExists:vi.fn(async()=>true),readFile:vi.fn(async()=>disk),writeFile:vi.fn(async(_path:string,content:string)=>{disk=content;})};
    const store = new Store({fileService,registry:{register(){}},appStore:{filePath:"document.md",showStatus:vi.fn(),saveConfig:async()=>{}},weekStore:null});
    await open(store); await store.flushSave();
    return {store,fileService,disk:()=>disk,external:()=>{disk=external;},open:()=>open(store),edit:(value:string)=>edit(store,value),text:()=>text(store)};
  }};
}
const cases = [
 scenario("Todo",TodoStore,"- [ ] initial\n","- [ ] external\n",s=>s.loadFile({path:"document.md"}),(s,text)=>s.updateText(s.todos[0].id,text),s=>{const first=s.todos[0];if(!first.isTodo)throw new Error("Expected todo");return first.text;}),
 scenario("Day",DailyStore,"# 2026-09-28\n\n## Notes\n\ninitial\n","# 2026-09-28\n\n## Notes\n\nexternal\n",s=>s.loadPath("document.md","2026-09-28"),(s,text)=>s.updateNotes(text),s=>s.notesRaw.trim()),
 scenario("Week",WeekStore,"# Week\n\n## Notes\n\ninitial\n","# Week\n\n## Notes\n\nexternal\n",s=>s.loadPath("document.md",{year:2026,week:40,rangeLabel:"September 28 - October 4"}),(s,text)=>s.updateNotes(text),s=>s.notesRaw.trim()),
 scenario("Scratchpad",ScratchpadStore,"initial","external",s=>s.loadPath("document.md"),(s,text)=>s.updateContent(text),s=>s.content)
];

describe.each(cases)("$name shared lifecycle contract", (c) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("saves its latest visible data through DocumentController", async () => {
    const { store, disk, edit } = await c.harness();
    expect(store.persistence).toBeInstanceOf(DocumentController);
    edit( "latest");
    expect(await store.flushSave()).toBe(true);
    expect(disk()).toContain("latest");
    expect(store.dirty).toBe(false);
  });

  it("applies external content automatically when clean", async () => {
    const { store, external, text } = await c.harness();
    external();
    expect(await store.checkExternalChanges()).toBe(true);
    expect(text()).toBe("external");
    expect(store.conflict).toBeNull();
    expect(store.dirty).toBe(false);
  });

  it("keeps current local data through conflict, focus and Keep Local", async () => {
    const { store, external, disk, edit, open, text } = await c.harness();
    edit( "older local");
    external();
    expect(await store.flushSave()).toBe(false);
    edit( "latest local");
    expect(await open()).toBe(true);
    expect(text()).toBe("latest local");
    expect(requireValue(store.conflict).localContent).toContain("latest local");
    expect(await store.resolveConflict("keep-local")).toBe(true);
    expect(disk()).toContain("latest local");
    expect(store.conflict).toBeNull();
  });

  it.each(["readFile", "writeFile"] as const)("blocks close on %s failure and saves the retained data on retry", async (operation) => {
    const { store, fileService, disk, edit, text } = await c.harness();
    const read = requireValue(fileService.readFile.getMockImplementation());
    const write = requireValue(fileService.writeFile.getMockImplementation());
    edit( "unsaved");
    fileService[operation].mockRejectedValue(new Error("locked"));
    expect(await store.unload()).toBe(false);
    expect(store.persistence.loaded).toBe(true);
    expect(text()).toBe("unsaved");
    expect(store.dirty).toBe(true);
    if (operation === "readFile") fileService.readFile.mockImplementation(read);
    else fileService.writeFile.mockImplementation(write);
    expect(await store.flushSave()).toBe(true);
    expect(disk()).toContain("unsaved");
    expect(await store.unload()).toBe(true);
    expect(store.persistence.loaded).toBe(false);
  });
});
