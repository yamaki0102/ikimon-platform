param(
    [string]$BaseUrl = 'https://ikimon.life',
    [string]$ObservationId = '',
    [string]$SpeciesSlug = ''
)

$ErrorActionPreference = 'Stop'

function Invoke-SmokeRequest {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [int[]]$AllowedStatusCodes = @(200)
    )

    try {
        if ($null -ne $Body) {
            $response = Invoke-WebRequest -Uri $Url -Method $Method -Body $Body -SkipHttpErrorCheck
        } else {
            $response = Invoke-WebRequest -Uri $Url -Method $Method -SkipHttpErrorCheck
        }

        $bodyText = ''
        if ($null -ne $response.Content) {
            $bodyText = [string]$response.Content
        }

        $statusOk = $AllowedStatusCodes -contains [int]$response.StatusCode
        $noServerError = [int]$response.StatusCode -lt 500

        [pscustomobject]@{
            Name = $Name
            Method = $Method
            StatusCode = [int]$response.StatusCode
            Passed = ($statusOk -and $noServerError)
            Url = $Url
            Snippet = ($bodyText.Substring(0, [Math]::Min(120, $bodyText.Length))).Replace("`r", ' ').Replace("`n", ' ')
        }
    } catch {
        [pscustomobject]@{
            Name = $Name
            Method = $Method
            StatusCode = 0
            Passed = $false
            Url = $Url
            Snippet = $_.Exception.Message
        }
    }
}

$normalizedBase = $BaseUrl.TrimEnd('/')
$checks = @(
    @{ Name = 'home'; Method = 'GET'; Url = "$normalizedBase/"; Allowed = @(200) },
    @{ Name = 'post-page'; Method = 'GET'; Url = "$normalizedBase/post.php"; Allowed = @(200) },
    @{ Name = 'api-post-observation-get'; Method = 'GET'; Url = "$normalizedBase/api/post_observation.php"; Allowed = @(200) },
    @{ Name = 'api-post-observation-post'; Method = 'POST'; Url = "$normalizedBase/api/post_observation.php"; Allowed = @(200); Body = @{} },
    @{ Name = 'api-post-identification-get'; Method = 'GET'; Url = "$normalizedBase/api/post_identification.php"; Allowed = @(200) }
)

if ($ObservationId) {
    $checks += @{
        Name = 'observation-detail'
        Method = 'GET'
        Url = "$normalizedBase/obs/$ObservationId"
        Allowed = @(200)
    }
}

if ($SpeciesSlug) {
    $checks += @{
        Name = 'species-page'
        Method = 'GET'
        Url = "$normalizedBase/species/$SpeciesSlug"
        Allowed = @(200)
    }
}

$results = foreach ($check in $checks) {
    Invoke-SmokeRequest -Name $check.Name -Method $check.Method -Url $check.Url -Body $check.Body -AllowedStatusCodes $check.Allowed
}

$results | Format-Table -AutoSize

$failed = $results | Where-Object { -not $_.Passed }
if ($failed) {
    Write-Error ("Smoke test failed: " + (($failed | ForEach-Object { $_.Name }) -join ', '))
}
