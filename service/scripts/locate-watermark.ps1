Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories\trai-cay.jpg")

# Find coordinates of pixels where x is small and y is between 0 and height
for ($y = 300; $y -lt 650; $y += 20) {
    $row = ""
    for ($x = 20; $x -lt 160; $x += 10) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 230 -or $c.G -lt 230 -or $c.B -lt 230) {
            $row += "X"
        } else {
            $row += "."
        }
    }
    Write-Host "y=${y}: $row"
}
$bmp.Dispose()

