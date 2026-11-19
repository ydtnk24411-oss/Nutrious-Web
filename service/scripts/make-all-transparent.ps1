Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories"

$categoryFiles = @(
    @{ name = "banh.png"; clean = "banh.png"; stripLeft = 0 },
    @{ name = "trai-cay.jpg"; clean = "trai-cay.png"; stripLeft = 110 },
    @{ name = "thit.jpg"; clean = "thit.png"; stripLeft = 0 },
    @{ name = "nuoc-uong.jpg"; clean = "nuoc-uong.png"; stripLeft = 0 },
    @{ name = "do-kho.png"; clean = "do-kho.png"; stripLeft = 0 },
    @{ name = "ca-va-haisan.jpg"; clean = "ca-va-haisan.png"; stripLeft = 0 },
    @{ name = "sua.jpg"; clean = "sua.png"; stripLeft = 0 },
    @{ name = "rau-cu.png"; clean = "rau-cu.png"; stripLeft = 0 }
)

foreach ($item in $categoryFiles) {
    $srcPath = Join-Path $dir $item.name
    if (-not (Test-Path $srcPath)) {
        Write-Host "File not found: $srcPath"
        continue
    }

    $srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
    $w = $srcBmp.Width
    $h = $srcBmp.Height
    $outBmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    # First copy all pixels
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $c = $srcBmp.GetPixel($x, $y)
            $outBmp.SetPixel($x, $y, $c)
        }
    }

    # Helper to check if pixel is background (near white/light gray)
    # Most background pixels are R >= 225, G >= 225, B >= 225
    function IsBg($px) {
        return ($px.R -ge 220 -and $px.G -ge 220 -and $px.B -ge 220)
    }

    # BFS Flood fill from edges
    $visited = New-Object 'bool[,]' $w, $h
    $queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]

    # Seed top and bottom
    for ($x = 0; $x -lt $w; $x++) {
        $topPx = $srcBmp.GetPixel($x, 0)
        if (IsBg $topPx) {
            $queue.Enqueue([System.Drawing.Point]::new($x, 0))
            $visited[$x, 0] = $true
        }
        $botPx = $srcBmp.GetPixel($x, $h - 1)
        if (IsBg $botPx) {
            $queue.Enqueue([System.Drawing.Point]::new($x, $h - 1))
            $visited[$x, $h - 1] = $true
        }
    }

    # Seed left and right
    for ($y = 0; $y -lt $h; $y++) {
        if (-not $visited[0, $y]) {
            $leftPx = $srcBmp.GetPixel(0, $y)
            if (IsBg $leftPx) {
                $queue.Enqueue([System.Drawing.Point]::new(0, $y))
                $visited[0, $y] = $true
            }
        }
        if (-not $visited[$w - 1, $y]) {
            $rightPx = $srcBmp.GetPixel($w - 1, $y)
            if (IsBg $rightPx) {
                $queue.Enqueue([System.Drawing.Point]::new($w - 1, $y))
                $visited[$w - 1, $y] = $true
            }
        }
    }

    $transparent = [System.Drawing.Color]::FromArgb(0, 255, 255, 255)

    while ($queue.Count -gt 0) {
        $pt = $queue.Dequeue()
        $outBmp.SetPixel($pt.X, $pt.Y, $transparent)

        $neighbors = @(
            [System.Drawing.Point]::new($pt.X - 1, $pt.Y),
            [System.Drawing.Point]::new($pt.X + 1, $pt.Y),
            [System.Drawing.Point]::new($pt.X, $pt.Y - 1),
            [System.Drawing.Point]::new($pt.X, $pt.Y + 1)
        )

        foreach ($n in $neighbors) {
            if ($n.X -ge 0 -and $n.X -lt $w -and $n.Y -ge 0 -and $n.Y -lt $h) {
                if (-not $visited[$n.X, $n.Y]) {
                    $visited[$n.X, $n.Y] = $true
                    $px = $srcBmp.GetPixel($n.X, $n.Y)
                    if (IsBg $px) {
                        $queue.Enqueue($n)
                    }
                }
            }
        }
    }

    # If stripLeft is specified (e.g. for watermark in trai-cay.jpg)
    if ($item.stripLeft -gt 0) {
        for ($x = 0; $x -lt $item.stripLeft; $x++) {
            for ($y = 0; $y -lt $h; $y++) {
                $outBmp.SetPixel($x, $y, $transparent)
            }
        }
    }

    # Also clean any stray near-white pixels anywhere
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $p = $outBmp.GetPixel($x, $y)
            if ($p.A -gt 0 -and $p.R -ge 245 -and $p.G -ge 245 -and $p.B -ge 245) {
                $outBmp.SetPixel($x, $y, $transparent)
            }
        }
    }

    $srcBmp.Dispose()

    # Save to clean PNG
    $outPath = Join-Path $dir $item.clean
    $outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()

    Write-Host "Created transparent PNG: $($item.clean)"
}

Write-Host "All category images made transparent!"

