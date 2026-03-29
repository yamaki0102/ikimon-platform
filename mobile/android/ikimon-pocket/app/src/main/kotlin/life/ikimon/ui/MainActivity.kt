package life.ikimon.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import life.ikimon.pocket.PocketService

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        // パーミッション結果のハンドリング
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            IkimonTheme {
                HomeScreen(
                    onStartPocket = { startPocketMode() },
                    onStopPocket = { stopPocketMode() },
                    onRequestPermissions = { requestPermissions() }
                )
            }
        }
    }

    private fun requestPermissions() {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.POST_NOTIFICATIONS,
            )
        )
    }

    private fun startPocketMode() {
        if (!hasRequiredPermissions()) {
            requestPermissions()
            return
        }
        PocketService.start(this)
    }

    private fun stopPocketMode() {
        PocketService.stop(this)
    }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }
}

@Composable
fun HomeScreen(
    onStartPocket: () -> Unit,
    onStopPocket: () -> Unit,
    onRequestPermissions: () -> Unit,
) {
    var isPocketActive by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            // Header
            Text("🌿", fontSize = 48.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "ikimon BioScan",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "歩くだけで、自然が記録される",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "Powered by BirdNET+ V3.0 — 11,560 species",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            )

            Spacer(modifier = Modifier.weight(1f))

            // Pocket Mode Button
            Button(
                onClick = {
                    if (isPocketActive) {
                        onStopPocket()
                        isPocketActive = false
                    } else {
                        onStartPocket()
                        isPocketActive = true
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isPocketActive)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.primary
                ),
                shape = MaterialTheme.shapes.large,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        if (isPocketActive) "🛑 ポケットモード停止" else "🎧 ポケットモード ON",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        if (isPocketActive) "タップで停止" else "スマホをポケットに入れるだけ",
                        fontSize = 12.sp,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Info text
            if (isPocketActive) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("🟢 記録中", fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "環境音をモニタリングしています。\nスマホをポケットに入れて散歩を楽しんでください。",
                            fontSize = 14.sp,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}

@Composable
fun IkimonTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = dynamicLightColorScheme(),
        content = content,
    )
}

@Composable
private fun dynamicLightColorScheme(): ColorScheme {
    return lightColorScheme(
        primary = androidx.compose.ui.graphics.Color(0xFF2E7D32),
        onPrimary = androidx.compose.ui.graphics.Color.White,
        primaryContainer = androidx.compose.ui.graphics.Color(0xFFE8F5E9),
    )
}
