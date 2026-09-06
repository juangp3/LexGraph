Import-Module Microsoft.PowerShell.Security

$compartmentId = "ocid1.tenancy.oc1..aaaaaaaa2qv7uy52djbntbl4inrlzia2n5gxsj2zgdnpuff7m3jxujsjdo6a"
$imageId       = "ocid1.image.oc1.eu-amsterdam-1.aaaaaaaa4dzbzoo2zlfhc3pgpiiziqh4yg3jq6yenudo7s4u6buvovhcdqqa"
$subnetId      = "ocid1.subnet.oc1.eu-amsterdam-1.aaaaaaaapbj3ou4c4w52edebm74aw4o2kcldvj7xuqoxemkl4bwengsrnmva"
$sshKeyPath    = "$HOME\.ssh\lexgraph_deploy.pub"
$availabilityDomain = "bHzI:eu-amsterdam-1-AD-1"


Import-Module Microsoft.PowerShell.Security

function Show-Notification {
    param([string]$Title, [string]$Message, [string]$IconType = "Info")
    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.Visible = $true
    $notify.ShowBalloonTip(10000, $Title, $Message, [System.Windows.Forms.ToolTipIcon]::$IconType)
    Start-Sleep -Seconds 11
    $notify.Dispose()
}
Write-Host "Starting OCI instance launch retry loop... (Ctrl+C to stop)"

$baseInterval = 120   # seconds between normal attempts — slower to avoid rate limits
$rateLimitBackoff = 300   # seconds to wait specifically after a 429

while ($true) {
    $result = oci compute instance launch `
        --availability-domain $availabilityDomain `
        --compartment-id $compartmentId `
        --shape "VM.Standard.A1.Flex" `
        --shape-config '{"ocpus":1,"memoryInGBs":6}' `
        --image-id $imageId `
        --subnet-id $subnetId `
        --assign-public-ip true `
        --ssh-authorized-keys-file $sshKeyPath `
        --display-name "lexgraph-vm" 2>&1 | Out-String

    if ($result -match '"lifecycle-state":\s*"PROVISIONING"') {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') — SUCCESS: instance launched" -ForegroundColor Green
        Show-Notification -Title "OCI — LexGraph VM" -Message "Instance launched successfully!" -IconType "Info"
        break
    }
    elseif ($result -match "Out of host capacity") {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') — still out of capacity, retrying in $baseInterval s..."
        Start-Sleep -Seconds $baseInterval
    }
    elseif ($result -match "TooManyRequests" -or $result -match '"status":\s*429') {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') — rate limited, backing off for $rateLimitBackoff s..." -ForegroundColor Yellow
        Start-Sleep -Seconds $rateLimitBackoff
    }
    else {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') — Unexpected error, stopping:" -ForegroundColor Red
        Write-Host $result
        Show-Notification -Title "OCI — LexGraph VM" -Message "Launch stopped: unexpected error. Check the terminal." -IconType "Error"
        break
    }
}