// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { captureEditableText } from "./editableTextClipboard.js";
import { buildEditableTextMenuItems } from "./editableTextMenuItems.js";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn()
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("editable text menu items", () => {
  it("builds configurable actions with shared lifecycle and error handling", async () => {
    const input = document.createElement("input");
    input.value = "Alpha Beta";
    document.body.append(input);
    input.setSelectionRange(0, 5);
    const beforeAction = vi.fn();
    const onError = vi.fn();
    const items = buildEditableTextMenuItems(captureEditableText(input), {
      beforeAction,
      onError,
      includeSelectAll: false,
      trailingSeparator: false
    });

    expect(items.map((item) => item.label)).toEqual(["Cut", "Copy", "Paste"]);
    writeText.mockRejectedValueOnce(new Error("denied"));
    await items[0].onclick();

    expect(beforeAction).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "denied" }));
    expect(input.value).toBe("Alpha Beta");
  });
});
