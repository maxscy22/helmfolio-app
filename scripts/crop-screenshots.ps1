# Auto-crops the left/right background margins from the marketing screenshots so
# the dashboard panel fills the frame. Top/bottom are left untouched.
#
# Method: per-column "horizontal gradient energy" = sum_y |lum(x) - lum(x+1)|.
# Smooth background / gradients produce near-zero energy; panel borders and text
# produce spikes. We crop to the first/last columns above a relative threshold.
#
# Source copies live in build/, so overwriting site/assets/* is safe.
#   Usage:  powershell -ExecutionPolicy Bypass -File scripts/crop-screenshots.ps1

Add-Type -AssemblyName System.Drawing

$root      = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root 'site\assets'

$files = @(
  'screenshot-dashboard.jpg',
  'screenshot-kpis.jpg',
  'screenshot-benchmark.jpg',
  'screenshot-equity.jpg',
  'screenshot-cash.jpg',
  'screenshot-leaderboard.jpg',
  'screenshot-calendar.jpg'
)

# JPEG encoder at quality 92
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int64]92)

foreach ($name in $files) {
  $path = Join-Path $assetsDir $name
  if (-not (Test-Path $path)) { Write-Host "skip (missing): $name"; continue }

  $bmp = New-Object System.Drawing.Bitmap($path)
  $w = $bmp.Width; $h = $bmp.Height

  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect,
    [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)

  # Per-column horizontal-gradient energy (sample every 2nd row for speed).
  $energy = New-Object double[] $w
  for ($y = 0; $y -lt $h; $y += 2) {
    $row = $y * $stride
    $prev = $null
    for ($x = 0; $x -lt $w; $x++) {
      $o = $row + $x * 3
      # luminance (BGR order in 24bppRgb)
      $lum = 0.114 * $bytes[$o] + 0.587 * $bytes[$o + 1] + 0.299 * $bytes[$o + 2]
      if ($null -ne $prev) {
        $d = [math]::Abs($lum - $prev)
        $energy[$x] += $d
      }
      $prev = $lum
    }
  }

  $maxE = ($energy | Measure-Object -Maximum).Maximum
  if ($maxE -le 0) { $bmp.Dispose(); Write-Host "skip (flat): $name"; continue }
  $threshold = $maxE * 0.06

  $left = 0
  for ($x = 0; $x -lt $w; $x++) { if ($energy[$x] -gt $threshold) { $left = $x; break } }
  $right = $w - 1
  for ($x = $w - 1; $x -ge 0; $x--) { if ($energy[$x] -gt $threshold) { $right = $x; break } }

  # padding + sanity guard
  $pad = 10
  $left  = [math]::Max(0, $left - $pad)
  $right = [math]::Min($w - 1, $right + $pad)
  $newW = $right - $left + 1
  if ($newW -lt ($w * 0.4) -or $newW -ge $w) {
    $bmp.Dispose()
    Write-Host ("skip (crop {0}->{1} unsafe): {2}" -f $w, $newW, $name)
    continue
  }

  $cropRect = New-Object System.Drawing.Rectangle($left, 0, $newW, $h)
  $cropped = $bmp.Clone($cropRect, $bmp.PixelFormat)
  $bmp.Dispose()

  $cropped.Save($path, $jpegCodec, $encParams)
  $cropped.Dispose()
  Write-Host ("{0}: {1}x{2} -> {3}x{2}  (trimmed L={4}px R={5}px)" -f `
    $name, $w, $h, $newW, $left, ($w - 1 - $right))
}

Write-Host 'Done.'
