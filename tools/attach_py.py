#!/usr/bin/env python3
"""
Attach an external window (by HWND) to the desktop WorkerW so it appears behind icons.
Usage: python attach_py.py <hwnd>
"""
import sys
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

def find_workerw():
    progman = user32.FindWindowW("Progman", None)
    if not progman:
        return 0
    # Send message to create WorkerW
    user32.SendMessageW(progman, 0x052C, 0, 0)

    found = 0

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def enum_proc(hwnd, lParam):
        nonlocal found
        buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, buf, 256)
        cls = buf.value
        if cls == 'WorkerW':
            shell = user32.FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', None)
            if shell:
                found = hwnd
                return False
        return True

    user32.EnumWindows(enum_proc, 0)
    return found

def attach(hwnd):
    worker = find_workerw()
    if not worker:
        return False
    res = user32.SetParent(wintypes.HWND(hwnd), wintypes.HWND(worker))
    return bool(res)

def main():
    if len(sys.argv) < 2:
        print('usage: attach_py.py <hwnd>', file=sys.stderr)
        return 2
    try:
        hwnd = int(sys.argv[1])
    except Exception:
        print('invalid hwnd', file=sys.stderr)
        return 3
    ok = attach(hwnd)
    return 0 if ok else 4

if __name__ == '__main__':
    sys.exit(main())
