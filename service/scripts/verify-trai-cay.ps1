Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories\trai-cay.png")

$darkCount = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt 48; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -ne 0) {
            $darkCount++
        }
    }
}

Write-Host "Non-transparent pixels in wipe zone (x < 48): $darkCount"

# Also check corner (0,0) and (10,10)
$c0 = $bmp.GetPixel(0,0)
$c10 = $bmp.GetPixel(10,10)
Write-Host "Pixel (0,0): A=$($c0.A), (10,10): A=$($c10.A)"

# Check a pixel inside the fruit:
$cFruit = $bmp.GetPixel(350, 400)
Write-Host "Pixel inside fruit (350,400): A=$($cFruit.A) R=$($cFruit.R) G=$($cFruit.G) B=$($cFruit.B)"

$bmp.Dispose()

