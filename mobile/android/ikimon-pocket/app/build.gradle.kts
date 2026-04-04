plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "life.ikimon.pocket"
    compileSdk = 35

    defaultConfig {
        applicationId = "life.ikimon.fieldscan"
        minSdk = 28
        targetSdk = 35
        versionCode = 80002
        versionName = "0.8.1"
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

    // TFLite (Perch v1 Bird Vocalization Classifier — SELECT_TF_OPS flex delegate)
    implementation("org.tensorflow:tensorflow-lite:2.14.0")
    implementation("org.tensorflow:tensorflow-lite-support:0.4.4")
    implementation("org.tensorflow:tensorflow-lite-select-tf-ops:2.14.0")

    // Gemini Nano on-device (視覚AI — Prompt API)
    implementation("com.google.mlkit:genai-prompt:1.0.0-beta1")

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
