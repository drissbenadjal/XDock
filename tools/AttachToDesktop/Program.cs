using System;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr FindWindowEx(IntPtr parentHandle, IntPtr childAfter, string lclassName, string windowTitle);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    static IntPtr findWorkerW()
    {
        var progman = FindWindow("Progman", null);
        SendMessage(progman, 0x052C, IntPtr.Zero, IntPtr.Zero);

        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            var sb = new System.Text.StringBuilder(256);
            GetClassName(hWnd, sb, sb.Capacity);
            var cls = sb.ToString();
            if (cls == "WorkerW")
            {
                var shellView = FindWindowEx(hWnd, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (shellView != IntPtr.Zero)
                {
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    static int Main(string[] args)
    {
        if (args.Length < 1) return 2;
        if (!long.TryParse(args[0], out var hwndLong)) return 3;
        IntPtr hwnd = new IntPtr(hwndLong);
        var worker = findWorkerW();
        if (worker == IntPtr.Zero) return 4;
        var res = SetParent(hwnd, worker);
        return res == IntPtr.Zero ? 5 : 0;
    }
}
