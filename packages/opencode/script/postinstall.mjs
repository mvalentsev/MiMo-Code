#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const packageName = `@mimo-ai/mimocode-${platform}-${arch}`
  const binaryName = platform === "windows" ? "mimo.exe" : "mimo"

  try {
    // Use require.resolve to find the package
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binaryName)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`)
    }

    return { binaryPath, binaryName }
  } catch (error) {
    throw new Error(`Could not find package ${packageName}: ${error.message}`, { cause: error })
  }
}

function isChineseLocale() {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANGUAGE || ""
  if (/^zh/i.test(lang)) return true
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    if (/^zh/i.test(locale)) return true
  } catch {}
  return false
}

function printMigrationNotice() {
  const isWin = os.platform() === "win32"
  const install = isWin
    ? "irm https://mimo.xiaomi.com/install.ps1 | iex"
    : "curl -fsSL https://mimo.xiaomi.com/install | bash"

  const zh = isChineseLocale()
  const title = zh ? "建议使用原生安装方式" : "Recommended: use native installer"
  const msg = zh
    ? `建议卸载 npm 包后通过原生方式安装，以获得更快的自动更新体验：\n     ${install}`
    : `Consider removing the npm package and installing natively for faster auto-updates:\n     ${install}`

  const yellow = "\x1b[33m"
  const bold = "\x1b[1m"
  const reset = "\x1b[0m"

  console.log()
  console.log(`${yellow}${bold}  ⚡ ${title}${reset}`)
  console.log(`     ${msg}`)
  console.log()
}

async function main() {
  printMigrationNotice()

  try {
    const { binaryPath } = findBinary()
    const target = path.join(__dirname, "bin", ".mimocode")
    if (fs.existsSync(target)) fs.unlinkSync(target)
    try {
      fs.linkSync(binaryPath, target)
    } catch {
      fs.copyFileSync(binaryPath, target)
    }
    if (os.platform() !== "win32") fs.chmodSync(target, 0o755)
  } catch (error) {
    console.error("Failed to setup mimocode binary:", error.message)
    process.exit(1)
  }
}

try {
  void main()
} catch (error) {
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
