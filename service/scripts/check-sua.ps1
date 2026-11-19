Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories\sua.jpg")
Write-Host "sua.jpg dimensions: $($bmp.Width)x$($bmp.Height)"

# Let's check if the milk bottle is closed by darker pixels
# Top of bottle:
for ($y = 0; $y -lt $bmp.Height; $y += 20) {
    $c = $bmp.GetPixel([int]($bmp.Width * 0.62), $y)
    if ($c.R -lt 240 -or $c.G -lt 240 -or $c.B -lt 240) {
        Write-Host "Top of bottle hit at y=${y}: R=$($c.R) G=$($c.G) B=$($c.B)"
        break
    }
}
$bmp.Dispose()
