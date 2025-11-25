import sys
import os

# Critical: Add the PyInstaller extraction path to sys.path
if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)
else:
    # Running in normal Python
    # Add src directory to path so 'scripts' can be found
    src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    sys.path.insert(0, src_path)

# Now import and run the worker
from scripts.core.worker import main
import asyncio

if __name__ == '__main__':
    asyncio.run(main())