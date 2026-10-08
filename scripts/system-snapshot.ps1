$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ActivityTrackerNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll", SetLastError=true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  public static uint IdleMilliseconds() {
    LASTINPUTINFO info = new LASTINPUTINFO(); info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return 0;
    return unchecked((uint)Environment.TickCount) - info.dwTime;
  }
  public static string WindowTitle(IntPtr window) {
    StringBuilder title = new StringBuilder(2048);
    GetWindowText(window, title, title.Capacity);
    return title.ToString();
  }
}
'@

$window = [ActivityTrackerNative]::GetForegroundWindow()
$processId = [uint32]0
[void][ActivityTrackerNative]::GetWindowThreadProcessId($window, [ref]$processId)
$process = $null
try { if ($processId -ne 0) { $process = Get-Process -Id $processId -ErrorAction Stop } } catch {}

$clipboardText = $null
$clipboardKind = 'empty'
try {
  $clipboardText = Get-Clipboard -Raw -ErrorAction Stop
  if ($null -ne $clipboardText) { $clipboardKind = 'text' }
} catch {
  try {
    $files = Get-Clipboard -Format FileDropList -ErrorAction Stop
    if ($files) { $clipboardKind = 'files' }
  } catch {}
}

$network = @()
try {
  if ($processId -ne 0) {
    $connections = Get-NetTCPConnection -OwningProcess $processId -State Established -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
      $network += [pscustomobject]@{
        localAddress = $conn.LocalAddress
        localPort = $conn.LocalPort
        remoteAddress = $conn.RemoteAddress
        remotePort = $conn.RemotePort
      }
    }
  }
} catch {}

[pscustomobject]@{
  appName = if ($process) { $process.ProcessName + '.exe' } else { $null }
  processId = if ($processId -ne 0) { [int]$processId } else { $null }
  windowTitle = [ActivityTrackerNative]::WindowTitle($window)
  idleMs = [ActivityTrackerNative]::IdleMilliseconds()
  clipboard = [pscustomobject]@{
    kind = $clipboardKind
    text = $clipboardText
  }
  network = $network
} | ConvertTo-Json -Compress -Depth 4
