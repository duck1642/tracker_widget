import { applyLayerMode } from "$lib/services/windowLayer.js";
import * as configService from "$lib/services/config.js";
import * as autostartService from "$lib/services/autostart.js";

class AppStore {
  filePath = $state("");
  layerMode = $state("normal");
  dragEnabled = $state(true);
  autostartEnabled = $state(false);
  currentView = $state("tasks"); // 'tasks', 'week', 'day'
  statusMessage = $state("");

  /** @param {string} msg */
  showStatus(msg) {
    this.statusMessage = msg;
    setTimeout(() => {
      if (this.statusMessage === msg) {
        this.statusMessage = "";
      }
    }, 2000);
  }

  async loadConfig() {
    try {
      const config = await configService.readConfig();
      this.filePath = config.file_path;
      this.dragEnabled = config.drag_enabled;
      this.layerMode = config.layer_mode;
      
      try {
        this.autostartEnabled = await autostartService.isEnabled();
      } catch {
        this.autostartEnabled = config.autostart_enabled;
      }
      return config;
    } catch (err) {
      this.showStatus("Err Config Load: " + err);
      return null;
    }
  }

  async saveConfig() {
    try {
      await configService.writeConfig({
        file_path: this.filePath,
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
    try {
      this.layerMode = await applyLayerMode(this.layerMode, mode);
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
        await autostartService.disable();
        this.autostartEnabled = false;
        this.showStatus("Autostart Off");
      } else {
        await autostartService.enable();
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
