import type { AppConfig, FrontmatterMode, LayerMode } from "$lib/shared/services/types.ts";
import type { View } from "./types.ts";
import { applyLayerMode as applyNativeLayerMode } from "$lib/shared/services/windowLayer.ts";
import * as defaultConfigService from "$lib/shared/services/configService.ts";
import * as defaultAutostartService from "$lib/shared/services/autostart.ts";
import { todoPathForWorkspace } from "$lib/shared/services/logWorkspaceService.ts";

function isLayerMode(mode:string): mode is LayerMode { return mode === "normal" || mode === "top" || mode === "desktop"; }
function isFrontmatterMode(mode:string): mode is FrontmatterMode { return mode === "off" || mode === "personal"; }

export interface AppStoreOptions {
  applyLayerMode?: typeof applyNativeLayerMode;
  configService?: {readConfig():Promise<AppConfig>;writeConfig(config:AppConfig):Promise<void>};
  autostartService?: Pick<typeof defaultAutostartService,"isEnabled"|"enable"|"disable">;
}
export class AppStore {
  applyLayerMode: typeof applyNativeLayerMode;
  configService: NonNullable<AppStoreOptions["configService"]>;
  autostartService: NonNullable<AppStoreOptions["autostartService"]>;
  filePath = $state("");
  logsRootPath = $state("");
  layerMode = $state<LayerMode>("normal");
  dragEnabled = $state(true);
  autostartEnabled = $state(false);
  frontmatterMode = $state<FrontmatterMode>("off");
  currentView = $state<View>("todo");
  statusMessage = $state("");
  devMode = $state(false);


  constructor({
    applyLayerMode = applyNativeLayerMode,
    configService = defaultConfigService,
    autostartService = defaultAutostartService
  }: AppStoreOptions = {}) {
    this.applyLayerMode = applyLayerMode;
    this.configService = configService;
    this.autostartService = autostartService;
  }


  showStatus(msg: string) {
    this.statusMessage = msg;
    setTimeout(() => {
      if (this.statusMessage === msg) this.statusMessage = "";
    }, 2000);
  }

  async loadConfig() {
    try {
      const config = await this.configService.readConfig();
      this.filePath = config.file_path;
      this.logsRootPath = config.logs_root_path || "";
      if (this.logsRootPath && !this.filePath) {
        this.filePath = todoPathForWorkspace(this.logsRootPath);
      }
      this.dragEnabled = config.drag_enabled;
      this.frontmatterMode = isFrontmatterMode(config.frontmatter_mode) ? config.frontmatter_mode : "off";
      this.devMode = config.developer_mode || false;

      try {
        this.autostartEnabled = await this.autostartService.isEnabled();
      } catch {
        this.autostartEnabled = config.autostart_enabled;
      }

      const targetMode = isLayerMode(config.layer_mode)
        ? config.layer_mode
        : "normal";
      try {
        this.layerMode = await this.applyLayerMode("normal", targetMode);
      } catch (err) {
        this.layerMode = "normal";
        this.showStatus("Err Mode Restore: " + err);
      }
      return config;
    } catch (err) {
      this.showStatus("Err Config Load: " + err);
      return null;
    }
  }

  async saveConfig() {
    try {
      await this.configService.writeConfig({
        file_path: this.filePath,
        logs_root_path: this.logsRootPath,
        layer_mode: this.layerMode,
        drag_enabled: this.dragEnabled,
        autostart_enabled: this.autostartEnabled,
        frontmatter_mode: this.frontmatterMode,
        developer_mode: this.devMode
      });
    } catch (err) {
      this.showStatus("Err Config Save: " + err);
    }
  }


  async changeLayerMode(mode: string) {
    if (!isLayerMode(mode)) {
      this.showStatus("Err Mode: invalid mode");
      return;
    }
    try {
      this.layerMode = await this.applyLayerMode(this.layerMode, mode);
      await this.saveConfig();
      this.showStatus("Mode: " + mode);
    } catch (err) {
      this.showStatus("Err Mode: " + err);
    }
  }

  async toggleDrag() {
    this.dragEnabled = !this.dragEnabled;
    await this.saveConfig();
    this.showStatus(this.dragEnabled ? "Drag On" : "Drag Off");
  }

  async toggleAutostart() {
    try {
      if (this.autostartEnabled) {
        await this.autostartService.disable();
        this.autostartEnabled = false;
        this.showStatus("Autostart Off");
      } else {
        await this.autostartService.enable();
        this.autostartEnabled = true;
        this.showStatus("Autostart On");
      }
      await this.saveConfig();
    } catch (err) {
      this.showStatus("Err Startup: " + err);
    }
  }


  async changeFrontmatterMode(mode: string) {
    if (!isFrontmatterMode(mode)) {
      this.showStatus("Err Frontmatter: invalid mode");
      return;
    }
    this.frontmatterMode = mode;
    await this.saveConfig();
    this.showStatus(mode === "personal" ? "Frontmatter Personal" : "Frontmatter Off");
  }

  async toggleDevMode() {
    this.devMode = !this.devMode;
    await this.saveConfig();
    this.showStatus(this.devMode ? "Dev Mode On" : "Dev Mode Off");
  }
}

export const appStore = new AppStore();
