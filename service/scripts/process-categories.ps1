Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class ImageProcessor {
    public static void MakeTransparent(string srcPath, string destPath, int threshold, int stripLeft) {
        using (Bitmap src = new Bitmap(srcPath)) {
            int w = src.Width;
            int h = src.Height;
            using (Bitmap dest = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                for (int x = 0; x < w; x++) {
                    for (int y = 0; y < h; y++) {
                        Color c = src.GetPixel(x, y);
                        if (x < stripLeft) {
                            dest.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        } else if (c.R >= threshold && c.G >= threshold && c.B >= threshold) {
                            dest.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        } else {
                            dest.SetPixel(x, y, c);
                        }
                    }
                }
                dest.Save(destPath, ImageFormat.Png);
            }
        }
    }
}
"@

$dir = "C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories"

$list = @(
    @{ src = "banh.png"; dest = "banh.png"; thresh = 238; strip = 0 },
    @{ src = "trai-cay.jpg"; dest = "trai-cay.png"; thresh = 230; strip = 120 },
    @{ src = "thit.jpg"; dest = "thit.png"; thresh = 235; strip = 0 },
    @{ src = "nuoc-uong.jpg"; dest = "nuoc-uong.png"; thresh = 238; strip = 0 },
    @{ src = "do-kho.png"; dest = "do-kho.png"; thresh = 238; strip = 0 },
    @{ src = "ca-va-haisan.jpg"; dest = "ca-va-haisan.png"; thresh = 235; strip = 0 },
    @{ src = "sua.jpg"; dest = "sua.png"; thresh = 235; strip = 0 },
    @{ src = "rau-cu.png"; dest = "rau-cu.png"; thresh = 238; strip = 0 }
)

foreach ($item in $list) {
    $srcPath = Join-Path $dir $item.src
    $destPath = Join-Path $dir $item.dest
    Write-Host "Processing $($item.src) -> $($item.dest)..."
    [ImageProcessor]::MakeTransparent($srcPath, $destPath, $item.thresh, $item.strip)
    Write-Host "Done: $($item.dest)"
}

Write-Host "All 8 category images successfully processed into 32-bit transparent PNGs!"

