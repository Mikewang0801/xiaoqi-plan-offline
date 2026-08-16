$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $root 'assets\icon.png'
$image = [System.Drawing.Image]::FromFile($source)
try {
    foreach ($size in @(192, 512)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($image, 0, 0, $size, $size)
            }
            finally {
                $graphics.Dispose()
            }
            $target = Join-Path $root "public\icon-$size.png"
            $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "Generated $target"
        }
        finally {
            $bitmap.Dispose()
        }
    }
}
finally {
    $image.Dispose()
}
