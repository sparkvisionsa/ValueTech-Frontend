<#
  build_win_release.ps1
  Run from project root (or call via npm script).

  What it does:
    - Builds frontend (webpack / npm run build)
    - Creates/activates Windows venv (.venv) if present
    - Installs requirements and PyInstaller
    - Runs PyInstaller (onedir) on src\scripts\worker.py
    - Copies PyInstaller output into build\win_python_exe
    - Runs electron-builder to produce Windows artifacts

  Usage:
    Open PowerShell (non-elevated is okay), from project root:
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
      .\build-scripts\build_win_release.ps1

  Notes:
    - Adjust paths below if your repo layout differs.
    - Ensure Node + npm + python are on PATH.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------- Config ----------
$ProjectRoot = (Get-Location).Path
$VenvPath = Join-Path $ProjectRoot ".venv"
$PySourceScript = Join-Path $ProjectRoot "src\scripts\worker.py"
$PyInstallerName = "excec_worker"
$PyDistDir = Join-Path $ProjectRoot "dist"
$PyInstallerOutputDir = Join-Path $ProjectRoot "dist\$PyInstallerName"
$StagingDir = Join-Path $ProjectRoot "build\win_python_exe"
$ElectronBuilderArgs = @("--win","--x64")  # change if you need ia32/arm64
# ----------------------------

Write-Host "[BUILD-WIN] Project root: $ProjectRoot"

function Fail([string]$msg) {
  Write-Error $msg
  Exit 1
}

# 1) frontend build
Write-Host "[BUILD-WIN] Running frontend build (npm run build)..."
if (-not (Test-Path "$ProjectRoot\package.json")) {
  Fail "package.json not found in project root."
}

$buildResult = npm run build
if ($LASTEXITCODE -ne 0) {
  Fail "Frontend build failed. Fix errors and re-run."
}

# ensure dist/index.html exists
if (-not (Test-Path (Join-Path $PyDistDir "index.html"))) {
  Write-Warning "Warning: dist\index.html not found. Confirm your frontend build emitted to top-level 'dist'."
  # continue — electron-builder may still pack whatever exists, but likely you'll want index.html
}

# 2) Prepare or use Windows venv
if (Test-Path $VenvPath) {
  Write-Host "[BUILD-WIN] Using existing venv at $VenvPath"
} else {
  Write-Host "[BUILD-WIN] Creating Windows venv at $VenvPath"
  python -m venv $VenvPath
}

# Activate venv
$activateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
if (Test-Path $activateScript) {
  Write-Host "[BUILD-WIN] Activating venv..."
  & $activateScript
} else {
  # Try classic activate in same shell for cmd/g Bash: try the script path for Git Bash compatibility
  $activateBat = Join-Path $VenvPath "Scripts\activate.bat"
  if (Test-Path $activateBat) {
    Write-Host "[BUILD-WIN] Found activate.bat; invoking python directly from venv."
    $pythonCmd = Join-Path $VenvPath "Scripts\python.exe"
  } else {
    Fail "Cannot locate venv activation script. Ensure you have a Windows venv at .venv or create one."
  }
}

# Determine python executable to use (prefer venv one)
$pythonExe = Join-Path $VenvPath "Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
  Write-Host "[BUILD-WIN] venv python not found; falling back to system 'python' on PATH"
  $pythonExe = "python"
}

Write-Host "[BUILD-WIN] Using python: $pythonExe"

# 3) Install/upgrade pip, install requirements and pyinstaller
Write-Host "[BUILD-WIN] Ensuring pip and pyinstaller are installed..."
& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r requirements.txt
& $pythonExe -m pip install pyinstaller

# 4) Run PyInstaller (onedir) - isolate output using dist path
Write-Host "[BUILD-WIN] Cleaning previous PyInstaller outputs..."
Remove-Item -Recurse -Force "$ProjectRoot\build\pyinstaller_win_build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $StagingDir -ErrorAction SilentlyContinue

$pyDistPath = Join-Path $ProjectRoot "build\pyinstaller_win_build\dist"
$pyWorkPath = Join-Path $ProjectRoot "build\pyinstaller_win_build\build"
$pySpecPath = Join-Path $ProjectRoot "build\pyinstaller_win_build\spec"

New-Item -ItemType Directory -Path $pyDistPath -Force | Out-Null
New-Item -ItemType Directory -Path $pyWorkPath -Force | Out-Null
New-Item -ItemType Directory -Path $pySpecPath -Force | Out-Null

Write-Host "[BUILD-WIN] Running PyInstaller (onedir)..."
& $pythonExe -m PyInstaller --onedir --noconfirm `
  --name $PyInstallerName `
  --distpath $pyDistPath `
  --workpath $pyWorkPath `
  --specpath $pySpecPath `
  $PySourceScript

if (-not (Test-Path (Join-Path $pyDistPath $PyInstallerName))) {
  Fail "PyInstaller did not produce expected output at $($pyDistPath)\$PyInstallerName"
}

# 5) Stage PyInstaller output into build\win_python_exe
Write-Host "[BUILD-WIN] Staging PyInstaller output to $StagingDir"
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
Copy-Item -Path (Join-Path $pyDistPath $PyInstallerName)\* -Destination $StagingDir -Recurse -Force

# 6) Ensure worker exe exists
$expectedExe = Join-Path $StagingDir "$PyInstallerName.exe"
if (-not (Test-Path $expectedExe)) {
  # maybe it's in nested layout; try to find any exe
  $foundExe = Get-ChildItem -Path $StagingDir -Filter *.exe -Recurse | Select-Object -First 1
  if ($null -eq $foundExe) {
    Fail "No .exe found in staged folder: $StagingDir"
  } else {
    Write-Host "[BUILD-WIN] Found exe: $($foundExe.FullName)"
  }
} else {
  Write-Host "[BUILD-WIN] Worker exe staged: $expectedExe"
}

# 7) Run electron-builder to create Windows installer/artifact
Write-Host "[BUILD-WIN] Running electron-builder to create Windows artifact..."
# Use npx so that local electron-builder is used if present
$npx = "npx"
& $npx electron-builder @($ElectronBuilderArgs)

if ($LASTEXITCODE -ne 0) {
  Fail "electron-builder failed."
}

Write-Host "[BUILD-WIN] Build completed. Check the dist/ or release/ folder for artifacts."
