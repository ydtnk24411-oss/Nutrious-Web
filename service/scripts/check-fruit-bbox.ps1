Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories\trai-cay.jpg")
$minX = $bmp.Width
$maxX = 0
$minY = $bmp.Height
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 220 -or $c.G -lt 220 -or $c.B -lt 220) {
            # Check if this pixel is watermark or fruit
            # Fruit is mostly around center. Let's print x if x < 150
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Non-white bounding box: X=[$minX, $maxX], Y=[$minY, $maxY], total $($bmp.Width)x$($bmp.Height)"

# Now let's see what is in column x < 200:
for ($x = 0; $x -lt 250; $x += 10) {
    $darkCount = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 220 -or $c.G -lt 220 -or $c.B -lt 220) {
            $darkCount++
        }
    }
    Write-Host "x=${x} darkCount=${darkCount}"
}

$bmp.Dispose()
