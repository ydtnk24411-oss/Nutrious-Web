Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\ADMIN\.gemini\antigravity\brain\16b735ac-07ca-4c9b-87eb-b87b995232af\.user_uploaded\media_1794924363816_96fe341a.png"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Width: $($bmp.Width), Height: $($bmp.Height)"

# Row 1 image is roughly y=25 to y=105, text is roughly y=110 to y=135
# Row 2 image is roughly y=150 to y=230, text is roughly y=235 to y=260

# Let's find non-white bounding boxes for each column and row
$outDir = "C:\Users\ADMIN\Downloads\Nutrious-Web\my-app\public\images\categories"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# The 8 categories
# Row 0:
# Col 0: Rau củ, trái cây
# Col 1: Thịt, trứng, hải sản
# Col 2: Thức ăn chế biến, bún tươi
# Col 3: Thực phẩm đông, mát
# Row 1:
# Col 0: Bánh, kẹo, snack
# Col 1: Gia vị, gạo, thực phẩm khô
# Col 2: Sản phẩm cho bé
# Col 3: Chăm sóc cá nhân

$items = @(
    @{ name = "cat-rau-cu-trai-cay"; col = 0; row = 0 },
    @{ name = "cat-thit-trung-hai-san"; col = 1; row = 0 },
    @{ name = "cat-thuc-an-che-bien"; col = 2; row = 0 },
    @{ name = "cat-thuc-pham-dong-mat"; col = 3; row = 0 },
    @{ name = "cat-banh-keo-snack"; col = 0; row = 1 },
    @{ name = "cat-gia-vi-gao-kho"; col = 1; row = 1 },
    @{ name = "cat-cho-be"; col = 2; row = 1 },
    @{ name = "cat-cham-soc-ca-nhan"; col = 3; row = 1 }
)

foreach ($item in $items) {
    $xStart = $item.col * 256
    $width = 256
    $yStart = if ($item.row -eq 0) { 0 } else { 137 }
    $height = 137

    # Find tight bounding box of non-white pixels inside this cell (excluding text at the bottom if possible, or keeping the whole icon)
    # Let's find the non-white pixels
    $minX = $xStart + $width
    $maxX = $xStart
    $minY = $yStart + $height
    $maxY = $yStart

    # We want only the icon part (above text). Text starts around y=110 (row 0) or y=245 (row 1)
    $iconMaxYLimit = if ($item.row -eq 0) { 110 } else { 245 }

    for ($x = $xStart; $x -lt ($xStart + $width); $x++) {
        for ($y = $yStart; $y -lt $iconMaxYLimit; $y++) {
            $pixel = $bmp.GetPixel($x, $y)
            # Check if not pure white
            if ($pixel.R -lt 250 -or $pixel.G -lt 250 -or $pixel.B -lt 250) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    Write-Host "$($item.name): bounds ($minX, $minY) to ($maxX, $maxY) [size: $($maxX - $minX) x $($maxY - $minY)]"

    # Add a little padding (e.g. 4px)
    $pad = 4
    $cropX = [Math]::Max(0, $minX - $pad)
    $cropY = [Math]::Max(0, $minY - $pad)
    $cropW = [Math]::Min($bmp.Width - $cropX, ($maxX - $minX) + ($pad * 2))
    $cropH = [Math]::Min($bmp.Height - $cropY, ($maxY - $minY) + ($pad * 2))

    $rect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropW, $cropH)
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    $targetPath = Join-Path $outDir "$($item.name).png"
    $cropped.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    Write-Host "Saved to $targetPath"
}

$bmp.Dispose()
Write-Host "Done cropping categories!"

