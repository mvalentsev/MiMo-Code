<#
.SYNOPSIS
    MiMoCode installer for Windows.
.DESCRIPTION
    Downloads and installs MiMoCode to $env:USERPROFILE\.mimocode\bin,
    then adds the directory to the user PATH.
.PARAMETER Version
    Install a specific version (e.g., 0.1.0). Defaults to latest.
.PARAMETER NoModifyPath
    Don't modify the user PATH environment variable.
.LINK
    https://mimo.xiaomi.com/coder
.EXAMPLE
    irm https://mimo.xiaomi.com/install.ps1 | iex
.EXAMPLE
    irm https://mimo.xiaomi.com/install.ps1 | iex -Args '-Version', '0.1.0'
#>
param(
    [String] $Version,
    [Switch] $NoModifyPath
)

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

$IS_EXECUTED_FROM_IEX = ($null -eq $MyInvocation.MyCommand.Path)

function Exit-Install {
    param([Int] $Code = 1)
    if ($IS_EXECUTED_FROM_IEX) {
        $Global:LASTEXITCODE = $Code
        break
    } else {
        exit $Code
    }
}

function Write-Err {
    param([String] $Msg)
    Write-Host $Msg -ForegroundColor Red
    Exit-Install 1
}

# --- Prerequisites ---

if (($PSVersionTable.PSVersion.Major) -lt 5) {
    Write-Err "PowerShell 5 or later is required. Visit https://microsoft.com/powershell"
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- Detect architecture ---

$Arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else {
    Write-Err "MiMoCode requires a 64-bit operating system."
}

# AVX2 baseline detection
$NeedsBaseline = $false
try {
    $code = @"
using System;
using System.Runtime.InteropServices;
public class CpuFeature {
    [DllImport("kernel32.dll")]
    public static extern bool IsProcessorFeaturePresent(int feature);
    public static bool HasAVX2() { return IsProcessorFeaturePresent(40); }
}
"@
    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
    if (-not [CpuFeature]::HasAVX2()) { $NeedsBaseline = $true }
} catch {
    # If detection fails, assume baseline for safety
    $NeedsBaseline = $true
}

$Target = "windows-$Arch"
if ($NeedsBaseline) { $Target = "$Target-baseline" }

# --- Resolve version ---

$FdsBase = if ($env:MIMO_FDS_BASE) { $env:MIMO_FDS_BASE.TrimEnd('/') } else {
    "https://mimocode.cnbj1.mi-fds.com/mimocode/mimocode"
}

if (-not $Version) {
    try {
        $Version = (Invoke-RestMethod "$FdsBase/releases/latest").Trim().TrimStart('v')
    } catch {
        Write-Err "Failed to fetch latest version. Check your network and retry, or specify -Version."
    }
} else {
    $Version = $Version.TrimStart('v')
}

# --- Check existing installation ---

$InstallDir = Join-Path $env:USERPROFILE ".mimocode\bin"

$Existing = Get-Command mimo -ErrorAction SilentlyContinue
if ($Existing) {
    $InstalledVersion = & mimo --version 2>$null
    if ($InstalledVersion -eq $Version) {
        Write-Host "MiMoCode v$Version is already installed." -ForegroundColor DarkGray
        Exit-Install 0
    }
    Write-Host "Installed version: $InstalledVersion" -ForegroundColor DarkGray
}

# --- Download and install ---

$Filename = "mimocode-$Target.zip"
$Url = "$FdsBase/releases/v$Version/$Filename"

Write-Host ""
Write-Host "Installing " -NoNewline -ForegroundColor DarkGray
Write-Host "mimocode" -NoNewline
Write-Host " version: " -NoNewline -ForegroundColor DarkGray
Write-Host "$Version"

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "mimocode_install_$PID"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
$ZipPath = Join-Path $TmpDir $Filename

try {
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
} catch {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
    Write-Err "Failed to download from $Url`n$($_.Exception.Message)"
}

# Extract
Expand-Archive -Path $ZipPath -DestinationPath $TmpDir -Force

# Move binary
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
$BinName = if (Test-Path (Join-Path $TmpDir "mimo.exe")) { "mimo.exe" } else { "mimo" }
Move-Item -Path (Join-Path $TmpDir $BinName) -Destination (Join-Path $InstallDir "mimo.exe") -Force
Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue

# --- Update PATH ---

$PathUpdated = $false
if (-not $NoModifyPath) {
    $UserPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable('PATH', "$InstallDir;$UserPath", 'User')
        $env:PATH = "$InstallDir;$env:PATH"
        $PathUpdated = $true
    }
}

# --- Print banner ---

Write-Host ""
$Dim = "DarkGray"
function Write-Logo($Left, $Right) {
    Write-Host $Left -NoNewline -ForegroundColor DarkGray; Write-Host $Right
}

$TermWidth = try { $Host.UI.RawUI.WindowSize.Width } catch { 80 }
if ($TermWidth -ge 80) {
    Write-Logo "  ███╗   ███╗ ██╗ ███╗   ███╗  ██████╗ " "  ██████╗  ██████╗  ██████╗  ███████╗"
    Write-Logo "  ████╗ ████║ ██║ ████╗ ████║ ██╔═══██╗" " ██╔════╝ ██╔═══██╗ ██╔══██╗ ██╔════╝"
    Write-Logo "  ██╔████╔██║ ██║ ██╔████╔██║ ██║   ██║" " ██║      ██║   ██║ ██║  ██║ █████╗  "
    Write-Logo "  ██║╚██╔╝██║ ██║ ██║╚██╔╝██║ ██║   ██║" " ██║      ██║   ██║ ██║  ██║ ██╔══╝  "
    Write-Logo "  ██║ ╚═╝ ██║ ██║ ██║ ╚═╝ ██║ ╚██████╔╝" " ╚██████╗ ╚██████╔╝ ██████╔╝ ███████╗"
    Write-Logo "  ╚═╝     ╚═╝ ╚═╝ ╚═╝     ╚═╝  ╚═════╝ " "  ╚═════╝  ╚═════╝  ╚═════╝  ╚══════╝"
} else {
    Write-Logo "█▀▄▀█ █ █▀▄▀█ █▀▀█" "  █▀▀ █▀▀█ █▀▀▄ █▀▀▀"
    Write-Logo "█ ▀ █ █ █ ▀ █ █  █" "  █   █  █ █  █ █▀▀ "
    Write-Logo "▀   ▀ ▀ ▀   ▀ ▀▀▀▀" "  ▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀▀"
}
Write-Host ""
Write-Host ""

if ($PathUpdated) {
    Write-Host "To get started, open a new terminal and run:" -ForegroundColor DarkGray
} else {
    Write-Host "To get started:" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  cd <project>"
Write-Host "  mimo"
Write-Host ""
Write-Host "For more information visit " -NoNewline -ForegroundColor DarkGray
Write-Host "https://mimo.xiaomi.com/coder/docs"
Write-Host ""
