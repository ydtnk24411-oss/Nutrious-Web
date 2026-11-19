Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories"
$files = @("banh.png", "trai-cay.jpg", "thit.jpg", "nuoc-uong.jpg", "do-kho.png", "ca-va-haisan.jpg", "sua.jpg", "rau-cu.png")

foreach ($f in $files) {
    $path = Join-Path $dir $f
    if (-not (Test-Path $path)) {
        Write-Host "File not found: $f"
        continue
    }
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $c00 = $bmp.GetPixel(0, 0)
    $cMidTop = $bmp.GetPixel([int]($bmp.Width/2), 0)
    $c0Mid = $bmp.GetPixel(0, [int]($bmp.Height/2))
    $cBR = $bmp.GetPixel($bmp.Width - 1, $bmp.Height - 1)
    Write-Host "$f ($($bmp.Width)x$($bmp.Height), format: $($bmp.PixelFormat))"
    Write-Host "   (0,0): R=$($c00.R) G=$($c00.G) B=$($c00.B) A=$($c00.A)"
    Write-Host "   (mid,0): R=$($cMidTop.R) G=$($cMidTop.G) B=$($cMidTop.B) A=$($cMidTop.A)"
    Write-Host "   (0,mid): R=$($c0Mid.R) G=$($c0Mid.G) B=$($c0Mid.B) A=$($c0Mid.A)"
    Write-Host "   (w-1,h-1): R=$($cBR.R) G=$($cBR.G) B=$($cBR.B) A=$($cBR.A)"
    $bmp.Dispose()
}

