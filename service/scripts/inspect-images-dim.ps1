Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\Admin\Downloads\Nutrious-Web\my-app\public\images\categories"
Get-ChildItem $dir | ForEach-Object {
    try {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
        Write-Host "$($_.Name): $($img.Width)x$($img.Height) $($img.PixelFormat)"
        $img.Dispose()
    } catch {
        Write-Host "Error reading $($_.Name): $_"
    }
}

