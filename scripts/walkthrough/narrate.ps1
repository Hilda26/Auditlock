$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$auditRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$auditNarration = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'narration.json') -Raw | ConvertFrom-Json
$auditAudioDirectory = Join-Path $auditRoot 'artifacts/private/walkthrough/audio'
[System.IO.Directory]::CreateDirectory($auditAudioDirectory) | Out-Null
$auditVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$auditVoice.SelectVoice('Microsoft Zira Desktop')
$auditVoice.Rate = 1
foreach ($auditEntry in $auditNarration.PSObject.Properties) {
  $auditWavePath = Join-Path $auditAudioDirectory ($auditEntry.Name + '.wav')
  $auditVoice.SetOutputToWaveFile($auditWavePath)
  $auditVoice.Speak($auditEntry.Value.text)
  $auditVoice.SetOutputToNull()
}
$auditVoice.Dispose()
Write-Output 'Walkthrough narration generated.'
