<#
.SYNOPSIS
    Sets up a dedicated virtual environment for optional local Qwen LLM execution on Windows.

.DESCRIPTION
    This script verifies Python, creates a dedicated `.venv-llm` virtual environment,
    upgrades pip inside it, and installs base and optional LLM requirements without modifying global packages.

.PARAMETER DryRun
    Simulates the setup process without creating files or installing packages.

.PARAMETER Help
    Displays help information and usage instructions.

.EXAMPLE
    .\scripts\setup_llm_windows.ps1

.EXAMPLE
    .\scripts\setup_llm_windows.ps1 -DryRun
#>

param(
    [switch]$DryRun,
    [switch]$Help
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path
    exit 0
}

$ErrorActionPreference = "Stop"

# Get repository root directory safely (handling paths with spaces)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "========================================================" -ForegroundColor Cy
Write-Host " AI CV Parser - Windows LLM Environment Setup" -ForegroundColor Cy
Write-Host "========================================================" -ForegroundColor Cy
Write-Host "Repository root: $RepoRoot"

# 1. Verify Python availability
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    $PythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}

if (-not $PythonCmd) {
    Write-Error "Python was not found in PATH. Please install Python 3.10+ and ensure it is added to PATH."
    exit 1
}

$PythonExe = $PythonCmd.Source
$PythonVersion = & "$PythonExe" --version 2>&1
Write-Host "Detected Python: $PythonVersion ($PythonExe)" -ForegroundColor Green

# 2. Define virtual environment path
$VenvDir = Join-Path $RepoRoot ".venv-llm"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"
$VenvActivate = Join-Path $VenvDir "Scripts\Activate.ps1"

$ReqBase = Join-Path $RepoRoot "requirements.txt"
$ReqLLM = Join-Path $RepoRoot "requirements-llm.txt"

if ($DryRun) {
    Write-Host "[DRY RUN] Would create virtual environment at: $VenvDir" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would upgrade pip in: $VenvDir" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would install requirements from: $ReqBase" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would install optional LLM requirements from: $ReqLLM" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Setup simulation completed successfully." -ForegroundColor Green
    exit 0
}

# 3. Create virtual environment
if (-not (Test-Path "$VenvPython")) {
    Write-Host "Creating dedicated virtual environment at '$VenvDir'..." -ForegroundColor Yellow
    & "$PythonExe" -m venv "$VenvDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create virtual environment at '$VenvDir'."
        exit 1
    }
} else {
    Write-Host "Virtual environment already exists at '$VenvDir'." -ForegroundColor Green
}

# 4. Upgrade pip
Write-Host "Upgrading pip inside virtual environment..." -ForegroundColor Yellow
& "$VenvPython" -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upgrade pip inside virtual environment."
    exit 1
}

# 5. Install base requirements
if (Test-Path "$ReqBase") {
    Write-Host "Installing base dependencies ($ReqBase)..." -ForegroundColor Yellow
    & "$VenvPip" install -r "$ReqBase"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install base requirements from '$ReqBase'."
        exit 1
    }
} else {
    Write-Warning "Base requirements file not found at '$ReqBase'."
}

# 6. Install optional LLM requirements
if (Test-Path "$ReqLLM") {
    Write-Host "Installing optional LLM dependencies ($ReqLLM)..." -ForegroundColor Yellow
    & "$VenvPip" install -r "$ReqLLM"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install LLM requirements from '$ReqLLM'."
        exit 1
    }
} else {
    Write-Warning "LLM requirements file not found at '$ReqLLM'."
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " LLM Environment Setup Completed Successfully!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "To activate your virtual environment in PowerShell, run:" -ForegroundColor Cyan
Write-Host "  & `"$VenvActivate`"" -ForegroundColor Yellow
Write-Host "Next step - Download the model using:" -ForegroundColor Cyan
Write-Host "  & `"$VenvPython`" scripts\download_model.py" -ForegroundColor Yellow
