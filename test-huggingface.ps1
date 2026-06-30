# test-huggingface.ps1
# Script untuk verifikasi koneksi Hugging Face Serverless Router API (v1)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " [TEST] Hugging Face Router v1 (OpenAI Compatible)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Read tokens from .env
$envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if (-not $envContent) {
    Write-Host "[ERROR] File .env tidak ditemukan!" -ForegroundColor Red
    exit 1
}

$tokenPrimary = ($envContent | Select-String 'HF_TOKEN_PRIMARY="([^"]+)"').Matches.Groups[1].Value
$tokenSecondary = ($envContent | Select-String 'HF_TOKEN_SECONDARY="([^"]+)"').Matches.Groups[1].Value

$models = @(
    "Qwen/Qwen2.5-7B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
)

function Test-HfToken($tokenName, $token) {
    if (-not $token) {
        Write-Host "[SKIP] Token $tokenName tidak ada di .env" -ForegroundColor Yellow
        return
    }

    Write-Host "`n---> Menguji Token ${tokenName}: $($token.Substring(0, 10))..." -ForegroundColor Yellow

    foreach ($model in $models) {
        Write-Host "     Model: $model ... " -NoNewline
        $body = @{
            model = $model
            messages = @(
                @{ role = "user"; content = "Berikan satu kalimat roasting lucu singkat tentang orang boros." }
            )
            max_tokens = 50
            temperature = 0.5
        } | ConvertTo-Json -Depth 5

        try {
            $response = Invoke-WebRequest -Uri "https://router.huggingface.co/v1/chat/completions" `
                -Method POST `
                -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
                -Body $body `
                -TimeoutSec 12 `
                -ErrorAction Stop

            $json = $response.Content | ConvertFrom-Json
            $text = $json.choices[0].message.content
            Write-Host "SUKSES!" -ForegroundColor Green
            Write-Host "     Output: $text" -ForegroundColor White
        } catch {
            Write-Host "GAGAL ($($_.Exception.Message))" -ForegroundColor Red
        }
    }
}

Test-HfToken "PRIMARY" $tokenPrimary
Test-HfToken "SECONDARY" $tokenSecondary

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host " [DONE] Pengujian selesai!" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
