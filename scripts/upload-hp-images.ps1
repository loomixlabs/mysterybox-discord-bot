$images = Get-ChildItem -Path "c:\ia mogo\bot discord\Gemini_Generated_Image_*.png"
$sshKey = "$env:USERPROFILE\.ssh\id_rsa_vps_hostinger"
$dest = "root@72.60.185.62:/var/www/html/hp-images/"

foreach ($img in $images) {
    Write-Host "Uploading: $($img.Name)"
    & scp -i $sshKey $img.FullName $dest
}

Write-Host "`n=== Upload complete! ==="
Write-Host "Total images: $($images.Count)"
