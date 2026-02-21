<?php

class VisionProcessor {
    private $apiKey;
    private $model = "gemini-1.5-flash"; // Faster, cheaper, good enough for OCR/Layout

    public function __construct($apiKey = null) {
        if ($apiKey) {
            $this->apiKey = $apiKey;
        } else {
            // Try to load from env
            $envPath = __DIR__ . '/../.env';
            if (file_exists($envPath)) {
                $env = parse_ini_file($envPath);
                $this->apiKey = $env['GOOGLE_API_KEY'] ?? null;
            }
        }
    }

    public function hasKey() {
        return !empty($this->apiKey);
    }

    public function analyzeImage($imagePath, $strategy) {
        if (!$this->hasKey()) {
            throw new Exception("Missing Google API Key. Cannot see.");
        }

        if (!file_exists($imagePath)) {
            throw new Exception("Image not found: $imagePath");
        }

        $imageData = base64_encode(file_get_contents($imagePath));
        $prompt = $this->getPromptForStrategy($strategy);

        // Prepare Request for Gemini API
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";
        
        $payload = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => $prompt],
                        [
                            "inline_data" => [
                                "mime_type" => "image/jpeg",
                                "data" => $imageData
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "response_mime_type" => "application/json"
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("Vision API Failed [$httpCode]: " . substr($response, 0, 200));
        }

        $json = json_decode($response, true);
        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$text) {
            throw new Exception("Empty response from Vision APi");
        }

        // Clean up markdown code blocks if present
        $text = str_replace(['```json', '```'], '', $text);
        
        return json_decode($text, true);
    }

    private function getPromptForStrategy($strategy) {
        // Strict prompts for different book types
        $base = "You are an expert biologist and archivist. Analyze this image from a Japanese biological field guide. Extract the data into valid structured JSON. Do NOT hallucinate. Text is in Japanese.";
        
        switch ($strategy) {
            case 'Visual Layout Mining':
                return $base . "\n" . 
                "The page likely has a 'Split Layout' (Top species / Bottom species) or a single full page profile.\n" .
                "1. Identify the layout (split_h, single, grid).\n" .
                "2. For each distinct species area, extract:\n" .
                "   - 'layout_position' (top, bottom, main)\n" . 
                "   - 'identity': { 'name_ja_verbatim': '...', 'scientific_name': '...' }\n" .
                "   - 'visual_features': { 'body_pattern': '...', 'distinctive_traits': '...' }\n" . 
                "   - 'biological_facts': { 'distribution': '...', 'size': '...' }\n" . 
                "   - 'archive_text': (Full Japanese text transcription of the description).\n" . 
                "Output structure: { 'description': 'Summary...', 'structured_data': { 'type': 'visual_guide_page', 'visual_semantics': {...}, 'species_entries': [...] } }";
            
            case 'Dimorphism Mining':
                return $base . "\n" .
                "The page features butterfly specimens, likely showing sexual dimorphism (Male/Female) or regional variants.\n" .
                "1. Extract each species.\n" .
                "2. For each species, identify distinct visual forms if present (e.g., 'Male Surface', 'Female Underside').\n" .
                "3. Extract:\n" .
                "   - 'identity': { 'name_ja': '...', 'scientific_name': '...' }\n" .
                "   - 'dimorphism': { 'has_dimorphism': true/false, 'details': 'Male is blue, Female is brown...' }\n" .
                "   - 'distribution': '...'\n" .
                "   - 'description': (Transcribe the explanatory text).\n" .
                "Output structure: { 'description': 'Page summary', 'structured_data': { 'type': 'species_profile', 'species_entries': [...] } }";
            
            default:
                return $base . "\n" . "Extract all biological entities and their visual features.";
        }
    }
}
