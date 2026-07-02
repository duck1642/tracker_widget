import { applyLayerMode as applyNativeLayerMode } from "$lib/shared/services/windowLayer.js";
import * as defaultConfigService from "$lib/shared/services/configService.js";
import * as defaultAutostartService from "$lib/shared/services/autostart.js";
import { todoPathForWorkspace } from "$lib/shared/services/logWorkspaceService.js";

const VALID_LAYER_MODES = new Set(["normal", "top", "desktop"]);

export class AppStore {
  filePath = $state("");
  logsRootPath = $state("");
  layerMode = $state("normal");
  dragEnabled = $state(true);
  autostartEnabled = $state(false);
  currentView = $state("todo");
  statusMessage = $state("");

  /** @param {{applyLayerMode?: Function, configService?: any, autostartService?: any}} [dependencies] */
  constructor({
    applyLayerMode = applyNativeLayerMode,
    configService = defaultConfigService,
    autostartService = defaultAutostartService
  } = {}) {
    this.applyLayerMode = applyLayerMode;
    this.configService = configService;
    this.autostartService = autostartService;
  }

  /** @param {string} msg */
  showStatus(msg) {
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

      try {
        this.autostartEnabled = await this.autostartService.isEnabled();
      } catch {
        this.autostartEnabled = config.autostart_enabled;
      }

      const targetMode = VALID_LAYER_MODES.has(config.layer_mode)
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
        autostart_enabled: this.autostartEnabled
      });
    } catch (err) {
      this.showStatus("Err Config Save: " + err);
    }
  }

  /** @param {string} mode */
  async changeLayerMode(mode) {
    if (!VALID_LAYER_MODES.has(mode)) {
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
}

export const appStore = new AppStore();
