const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Sends a WhatsApp message to a group using PowerShell + WScript automation.
 * Uses Get-Process MainWindowHandle (not FindWindow) because WhatsApp's process
 * is named "WhatsApp.Root" and may have webview child processes.
 */
async function sendMessage(groupName, message) {
  const scriptPath = path.join(os.tmpdir(), `wa-notify-${Date.now()}.ps1`);

  const safeGroup = groupName.replace(/'/g, "''");
  const safeMsg   = message.replace(/'/g, "''");

  const script = `
Add-Type -AssemblyName System.Windows.Forms

# ── Win32 helpers ───────────────────────────────────────────────────────────
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WA2 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@

# Returns the main window handle of the WhatsApp process (excludes webview child procs)
function Get-WAHwnd {
    $procs = Get-Process | Where-Object {
        $_.Name -like '*WhatsApp*' -and
        $_.Name -notlike '*webview*' -and
        $_.Name -notlike '*edge*'
    }
    $withWindow = $procs | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
    if ($withWindow) { return $withWindow.MainWindowHandle }
    return [IntPtr]::Zero
}

# ── Save clipboard ───────────────────────────────────────────────────────────
$prevClip = ''
try { $prevClip = [System.Windows.Forms.Clipboard]::GetText() } catch {}

try {
    $hwnd = Get-WAHwnd

    if ($hwnd -eq [IntPtr]::Zero) {
        # Process exists but window is hidden (minimised to tray) — wake it up
        $wa = Get-Process | Where-Object { $_.Name -like '*WhatsApp*' -and $_.Name -notlike '*webview*' } | Select-Object -First 1
        if ($wa) {
            Write-Host "Activating WhatsApp (process: $($wa.Name) PID $($wa.Id))..."
            $wsh = New-Object -ComObject WScript.Shell
            $wsh.AppActivate($wa.Id) | Out-Null
            Start-Sleep -Seconds 2
            $hwnd = Get-WAHwnd
        }
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        # No WhatsApp process at all — launch it
        $localExe = "$env:LOCALAPPDATA\\WhatsApp\\WhatsApp.exe"
        if (Test-Path $localExe) {
            Write-Host "Launching WhatsApp from $localExe..."
            Start-Process $localExe
        } else {
            Write-Host 'Launching WhatsApp via protocol handler...'
            Start-Process 'whatsapp:'
        }

        # Poll every second for up to 25 seconds
        for ($i = 0; $i -lt 25; $i++) {
            Start-Sleep -Seconds 1
            $hwnd = Get-WAHwnd
            if ($hwnd -ne [IntPtr]::Zero) {
                Write-Host ("WhatsApp window ready after " + ($i + 1) + "s")
                break
            }
        }
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Error 'Could not find WhatsApp window. Make sure WhatsApp Desktop is installed.'
        exit 1
    }

    # ── Restore & focus ──────────────────────────────────────────────────────
    [WA2]::ShowWindow($hwnd, 9) | Out-Null    # SW_RESTORE
    Start-Sleep -Milliseconds 600
    [WA2]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 1000

    # ── Search for group (Ctrl+F) ────────────────────────────────────────────
    [System.Windows.Forms.SendKeys]::SendWait('^f')
    Start-Sleep -Milliseconds 800

    # ── Paste group name ─────────────────────────────────────────────────────
    [System.Windows.Forms.Clipboard]::SetText('${safeGroup}')
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 2000    # wait for search results

    # ── Select first result ──────────────────────────────────────────────────
    [System.Windows.Forms.SendKeys]::SendWait('{DOWN}')
    Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Milliseconds 1200

    # ── Paste and send message ───────────────────────────────────────────────
    [System.Windows.Forms.Clipboard]::SetText('${safeMsg}')
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

    Write-Host 'Message sent.'
} finally {
    try {
        if ($prevClip -ne '') { [System.Windows.Forms.Clipboard]::SetText($prevClip) }
        else { [System.Windows.Forms.Clipboard]::Clear() }
    } catch {}
}
`;

  fs.writeFileSync(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    exec(
      `powershell -ExecutionPolicy Bypass -NonInteractive -File "${scriptPath}"`,
      { timeout: 60000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(scriptPath); } catch {}
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      }
    );
  });
}

module.exports = { sendMessage };
