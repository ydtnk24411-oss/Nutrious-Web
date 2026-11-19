Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories\trai-cay.jpg")

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt 60; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 230 -or $c.G -lt 230 -or $c.B -lt 230) {
            Write-Host "Dark pixel at x=$x, y=$y (R=$($c.R), G=$($c.G), B=$($c.B))"
        }
    }
}
$bmp.Dispose()

