Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories"
Get-ChildItem -Path $dir | ForEach-Object {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($_.FullName)
        Write-Host "$($_.Name) => $($bmp.Width) x $($bmp.Height) ($($bmp.PixelFormat))"
        $bmp.Dispose()
    } catch {
        Write-Host "$($_.Name) => Error loading"
    }
}

