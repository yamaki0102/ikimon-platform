plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "life.ikimon.pocket"
    compileSdk = 35

    defaultConfig {
        applicationId = "life.ikimon.bioscan"
        minSdk = 28
        targetSdk = 35
        versionCode = 70001
        versionName = "0.7.0"
    }

    // BirdNET V3 ONNXモデル（541MB）はAPKに含めずaab/asset packで配布
    aaptOptions {
        noCompress += "onnx"
        noCompress += "csv"
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")

    // Location
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // ONNX Runtime (BirdNET+ V3.0)
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.20.0")

    // CameraX (Scan Mode)
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")

    // Network
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.0")

    // WorkManager (Background Sync)
    implementation("androidx.work:work-runtime-ktx:2.9.0")
}
