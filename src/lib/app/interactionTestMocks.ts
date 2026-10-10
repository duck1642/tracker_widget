import { vi } from "vitest";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn()
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn()
}));
