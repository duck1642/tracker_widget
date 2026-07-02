import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const appName = packageJson.name;
const version = packageJson.version;
const artifactsDir = path.join(root, "build-artifacts");
const portableDir = path.join(artifactsDir, `${appName}-portable`);
const zipPath = path.join(artifactsDir, `${appName}-portable-v${version}.zip`);
const exePath = path.join(root, "src-tauri", "target", "release", `${appName}.exe`);

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

if (!existsSync(exePath)) {
  throw new Error(`Release executable not found: ${exePath}`);
}

rmSync(portableDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(portableDir, { recursive: true });

cpSync(exePath, path.join(portableDir, `${appName}.exe`));
cpSync(path.join(root, "config.example.json"), path.join(portableDir, "config.example.json"));
cpSync(path.join(root, "templates"), path.join(portableDir, "templates"), { recursive: true });

writeFileSync(
  path.join(portableDir, "README-portable.txt"),
  [
    "Tracker Widget Portable",
    "",
    "Run tracker-widget.exe from this folder.",
    "On first launch, the app creates config.json next to the executable.",
    "Select a workspace folder in the app to create or import todo.md.",
    "",
    "To move the app, copy this whole folder.",
    ""
  ].join("\r\n")
);

const result = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Compress-Archive -Path ${psQuote(path.join(portableDir, "*"))} -DestinationPath ${psQuote(zipPath)} -Force`
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  throw new Error("Failed to create portable zip.");
}

console.log(`Created ${zipPath}`);
