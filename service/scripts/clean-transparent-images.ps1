Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class CleanImageProcessor {
    public static void ProcessImage(string srcPath, string destPath, int threshold, int wipeLeft) {
        byte[] bytes = File.ReadAllBytes(srcPath);
        using (MemoryStream ms = new MemoryStream(bytes))
        using (Bitmap src = new Bitmap(ms)) {
            int w = src.Width;
            int h = src.Height;
            
            bool[,] isBg = new bool[w, h];
            Queue<Point> q = new Queue<Point>();
            
            Func<Color, bool> isWhiteish = (c) => {
                return (c.R >= threshold && c.G >= threshold && c.B >= threshold);
            };
            
            // Seed from all border pixels
            for (int x = 0; x < w; x++) {
                if (isWhiteish(src.GetPixel(x, 0))) { isBg[x, 0] = true; q.Enqueue(new Point(x, 0)); }
                if (isWhiteish(src.GetPixel(x, h - 1))) { isBg[x, h - 1] = true; q.Enqueue(new Point(x, h - 1)); }
            }
            for (int y = 0; y < h; y++) {
                if (isWhiteish(src.GetPixel(0, y))) { isBg[0, y] = true; q.Enqueue(new Point(0, y)); }
                if (isWhiteish(src.GetPixel(w - 1, y))) { isBg[w - 1, y] = true; q.Enqueue(new Point(w - 1, y)); }
            }
            
            int[] dx = { 0, 0, 1, -1 };
            int[] dy = { 1, -1, 0, 0 };
            
            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i];
                    int ny = p.Y + dy[i];
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && !isBg[nx, ny]) {
                        if (isWhiteish(src.GetPixel(nx, ny))) {
                            isBg[nx, ny] = true;
                            q.Enqueue(new Point(nx, ny));
                        }
                    }
                }
            }
            
            using (Bitmap dest = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                for (int x = 0; x < w; x++) {
                    for (int y = 0; y < h; y++) {
                        if (x < wipeLeft) {
                            dest.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        } else if (isBg[x, y]) {
                            dest.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        } else {
                            Color c = src.GetPixel(x, y);
                            // Also clear any near-white leftover pixels that are disconnected
                            if (c.R >= 242 && c.G >= 242 && c.B >= 242) {
                                dest.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                            } else {
                                dest.SetPixel(x, y, Color.FromArgb(255, c.R, c.G, c.B));
                            }
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
    @{ src = "banh.png"; dest = "banh.png"; thresh = 232; wipe = 0 },
    @{ src = "trai-cay.jpg"; dest = "trai-cay.png"; thresh = 228; wipe = 48 },
    @{ src = "thit.jpg"; dest = "thit.png"; thresh = 230; wipe = 0 },
    @{ src = "nuoc-uong.jpg"; dest = "nuoc-uong.png"; thresh = 230; wipe = 0 },
    @{ src = "do-kho.png"; dest = "do-kho.png"; thresh = 230; wipe = 0 },
    @{ src = "ca-va-haisan.jpg"; dest = "ca-va-haisan.png"; thresh = 230; wipe = 0 },
    @{ src = "sua.jpg"; dest = "sua.png"; thresh = 230; wipe = 0 },
    @{ src = "rau-cu.png"; dest = "rau-cu.png"; thresh = 230; wipe = 0 }
)

foreach ($item in $list) {
    $srcPath = Join-Path $dir $item.src
    $destPath = Join-Path $dir $item.dest
    Write-Host "Processing $($item.src) -> $($item.dest)..."
    [CleanImageProcessor]::ProcessImage($srcPath, $destPath, $item.thresh, $item.wipe)
    Write-Host "Success: $($item.dest)"
}

Write-Host "All 8 images processed into transparent PNGs!"

