import { 
  enable as enableAutostart, 
  disable as disableAutostart, 
  isEnabled as isAutostartEnabled 
} from "@tauri-apps/plugin-autostart";

export async function isEnabled() {
  return await isAutostartEnabled();
}

export async function enable() {
  return await enableAutostart();
}

export async function disable() {
  return await disableAutostart();
}
