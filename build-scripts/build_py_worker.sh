#!/usr/bin/env bash
set -euo pipefail

# Build script for Python worker -> produces build/python_exe
# Run from project root: ./build-scripts/build_py_worker.sh

# Activate venv
if [ -f ".venv/bin/activate" ]; then
    echo "[BUILD] Activating virtual environment..."
    source .venv/bin/activate
else
    echo "[ERROR] No virtualenv found at .venv"
    exit 1
fi

echo "[BUILD] Ensuring PyInstaller is installed..."
pip install --upgrade pip
pip install pyinstaller

# Clean only pyinstaller-specific outputs (do NOT remove top-level dist/)
echo "[BUILD] Cleaning old pyinstaller artifacts..."
rm -rf build/python_exe
rm -rf build/pyinstaller_build
rm -f build/excec_worker.spec
mkdir -p build/python_exe

# Build with PyInstaller, telling it to place output under build/pyinstaller_build
# so it won't conflict with your web 'dist' folder.
PY_DISTPATH="build/pyinstaller_build/dist"
PY_WORKPATH="build/pyinstaller_build/build"
PY_SPECPATH="build/pyinstaller_build"
echo "[BUILD] Running PyInstaller (dist -> ${PY_DISTPATH})..."
pyinstaller --noconfirm \
  --distpath "${PY_DISTPATH}" \
  --workpath "${PY_WORKPATH}" \
  build-scripts/exec_worker.spec


# PyInstaller created ${PY_DISTPATH}/excec_worker
if [ ! -d "${PY_DISTPATH}/excec_worker" ]; then
  echo "[ERROR] PyInstaller did not produce ${PY_DISTPATH}/excec_worker"
  exit 1
fi

echo "[BUILD] Copying output to build/python_exe..."
cp -r "${PY_DISTPATH}/excec_worker/"* build/python_exe/

chmod -R +x build/python_exe || true

echo "[SUCCESS] Python worker built -> build/python_exe (contains excec_worker)"
