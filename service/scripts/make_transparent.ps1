Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\ADMIN\Downloads\Nutrious-Web\my-app\public\images\categories"
$files = Get-ChildItem -Path $dir -Filter "*.png"

foreach ($f in $files) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $newBmp = [System.Drawing.Bitmap]::new($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    # Copy pixels and make near-white background transparent using flood fill or corner check
    # Let's see: the background in the original image is pure white (R > 250, G > 250, B > 250)
    # Flood-fill BFS from (0,0) and borders to only make outer white transparent
    $visited = New-Object 'bool[,]' $bmp.Width, $bmp.Height
    $queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]

    # First copy all pixels
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $newBmp.SetPixel($x, $y, $bmp.GetPixel($x, $y))
        }
    }

    # Helper: is background white?
    function IsWhite($c) {
        return ($c.R -ge 248 -and $c.G -ge 248 -and $c.B -ge 248)
    }

    # Seed all border pixels
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        if (IsWhite ($bmp.GetPixel($x, 0))) {
            $queue.Enqueue([System.Drawing.Point]::new($x, 0))
            $visited[$x, 0] = $true
        }
        $bottom = $bmp.Height - 1
        if (IsWhite ($bmp.GetPixel($x, $bottom))) {
            $queue.Enqueue([System.Drawing.Point]::new($x, $bottom))
            $visited[$x, $bottom] = $true
        }
    }
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        if (-not $visited[0, $y] -and (IsWhite ($bmp.GetPixel(0, $y)))) {
            $queue.Enqueue([System.Drawing.Point]::new(0, $y))
            $visited[0, $y] = $true
        }
        $right = $bmp.Width - 1
        if (-not $visited[$right, $y] -and (IsWhite ($bmp.GetPixel($right, $y)))) {
            $queue.Enqueue([System.Drawing.Point]::new($right, $y))
            $visited[$right, $y] = $true
        }
    }

    $transparent = [System.Drawing.Color]::FromArgb(0, 255, 255, 255)

    while ($queue.Count -gt 0) {
        $pt = $queue.Dequeue()
        $newBmp.SetPixel($pt.X, $pt.Y, $transparent)

        # 4 neighbors
        $neighbors = @(
            [System.Drawing.Point]::new($pt.X - 1, $pt.Y),
            [System.Drawing.Point]::new($pt.X + 1, $pt.Y),
            [System.Drawing.Point]::new($pt.X, $pt.Y - 1),
            [System.Drawing.Point]::new($pt.X, $pt.Y + 1)
        )

        foreach ($n in $neighbors) {
            if ($n.X -ge 0 -and $n.X -lt $bmp.Width -and $n.Y -ge 0 -and $n.Y -lt $bmp.Height) {
                if (-not $visited[$n.X, $n.Y]) {
                    $visited[$n.X, $n.Y] = $true
                    $c = $bmp.GetPixel($n.X, $n.Y)
                    if (IsWhite $c) {
                        $queue.Enqueue($n)
                    }
                }
            }
        }
    }

    $bmp.Dispose()
    # Save back to file
    $newBmp.Save($f.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
    $newBmp.Dispose()
    Write-Host "Processed transparency for $($f.Name)"
}
Write-Host "All icons processed!"

