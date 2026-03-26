/**
 * BioPrescreen — TF.js MobileNet V2 による2層分析エンジン
 *
 * Layer 1: MobileNet (ブラウザ内, ¥0) — 全フレームを分析・記録
 * Layer 2: Gemini API (有料) — 新種検出・不明・定期サンプリング時のみ呼び出し
 *
 * 科学データは100%保持。Gemini API コストのみ ~67% 削減。
 */
var BioPrescreen = (function() {
    'use strict';

    var _model = null;
    var _available = false;
    var _loading = false;
    var _knownClasses = {};      // MobileNet で既に検出したクラス → Gemini 結果とのマッピング
    var _lastGeminiTime = 0;     // 最後に Gemini を呼んだ時刻
    var GEMINI_SAMPLE_INTERVAL = 30000; // 30秒ごとに定期サンプリング
    var _stats = { total: 0, geminiCalls: 0, localOnly: 0 };

    var BIO_KEYWORDS = [
        'cock', 'hen', 'ostrich', 'brambling', 'goldfinch', 'bunting', 'robin', 'bulbul',
        'jay', 'magpie', 'chickadee', 'dipper', 'kite', 'eagle', 'vulture', 'buzzard',
        'owl', 'grouse', 'peacock', 'quail', 'partridge', 'macaw', 'lorikeet', 'coucal',
        'bee eater', 'hornbill', 'hummingbird', 'jacamar', 'toucan', 'drake', 'goose',
        'penguin', 'albatross', 'pelican', 'king penguin', 'flamingo', 'crane', 'bustard',
        'bittern', 'spoonbill', 'stork', 'ibis', 'heron', 'limpkin', 'oystercatcher',
        'bird', 'parrot', 'finch', 'sparrow', 'warbler', 'wren', 'pigeon',
        'tench', 'goldfish', 'shark', 'ray', 'eel', 'coho', 'fish', 'barracouta',
        'lionfish', 'puffer', 'sturgeon', 'gar', 'anemone fish', 'clownfish',
        'newt', 'salamander', 'frog', 'toad', 'tree frog', 'bullfrog',
        'turtle', 'terrapin', 'mud turtle', 'box turtle', 'leatherback',
        'iguana', 'chameleon', 'agama', 'frilled lizard', 'alligator lizard',
        'gila monster', 'green lizard', 'gecko', 'whiptail', 'nile crocodile',
        'alligator', 'triceratops', 'snake', 'cobra', 'mamba', 'diamondback',
        'sidewinder', 'horned viper', 'boa', 'rock python', 'king snake',
        'garter snake', 'vine snake', 'night snake', 'thunder snake',
        'ringneck', 'hognose', 'green snake',
        'dog', 'cat', 'bear', 'wolf', 'fox', 'coyote', 'hyena', 'lion',
        'tiger', 'cheetah', 'cougar', 'lynx', 'leopard', 'jaguar', 'snow leopard',
        'elephant', 'hippopotamus', 'rhinoceros', 'deer', 'moose', 'elk',
        'rabbit', 'hare', 'squirrel', 'chipmunk', 'beaver', 'porcupine',
        'mouse', 'rat', 'hamster', 'guinea pig', 'bat', 'monkey', 'ape',
        'gorilla', 'chimpanzee', 'orangutan', 'gibbon', 'lemur', 'badger',
        'otter', 'weasel', 'mink', 'skunk', 'raccoon', 'panda',
        'horse', 'zebra', 'donkey', 'pig', 'boar', 'cow', 'ox', 'buffalo',
        'bison', 'sheep', 'goat', 'llama', 'camel', 'antelope', 'gazelle',
        'impala', 'ibex', 'ram', 'bighorn', 'whale', 'dolphin', 'seal',
        'sea lion', 'walrus', 'dugong', 'manatee', 'sloth', 'armadillo',
        'platypus', 'echidna', 'koala', 'wombat', 'wallaby', 'kangaroo',
        'collie', 'retriever', 'shepherd', 'terrier', 'spaniel', 'poodle',
        'hound', 'setter', 'pointer', 'husky', 'malamute', 'dalmatian',
        'pug', 'bulldog', 'boxer', 'mastiff', 'rottweiler', 'doberman',
        'schnauzer', 'chihuahua', 'corgi', 'dingo', 'siamese', 'persian',
        'tabby', 'egyptian cat',
        'bee', 'wasp', 'ant', 'butterfly', 'moth', 'beetle', 'ladybug',
        'weevil', 'fly', 'dragonfly', 'damselfly', 'cricket', 'grasshopper',
        'cockroach', 'mantis', 'cicada', 'leafhopper', 'lacewing',
        'spider', 'tarantula', 'scorpion', 'tick', 'centipede', 'millipede',
        'monarch', 'cabbage butterfly', 'sulphur butterfly', 'lycaenid',
        'admiral', 'ringlet', 'leaf beetle', 'long-horned beetle',
        'dung beetle', 'rhinoceros beetle', 'ground beetle',
        'jellyfish', 'sea anemone', 'coral', 'starfish', 'sea urchin',
        'sea cucumber', 'sea slug', 'nautilus', 'crab', 'lobster',
        'crayfish', 'hermit crab', 'isopod', 'snail', 'slug', 'conch',
        'trilobite', 'octopus', 'squid',
        'mushroom', 'agaric', 'stinkhorn', 'earthstar', 'hen-of-the-woods',
        'bolete', 'gyromitra', 'coral fungus',
        'daisy', 'sunflower', 'dandelion', 'rose', 'poppy', 'lily',
        'tulip', 'orchid', 'iris', 'lotus', 'flowerpot',
        'acorn', 'hip', 'rapeseed', 'corn',
        'banana', 'pineapple', 'strawberry', 'orange', 'lemon', 'fig',
        'pomegranate', 'jackfruit', 'custard apple',
        'worm', 'nematode', 'flatworm', 'leech',
    ];

    var _bioSet = null;
    function _initBioSet() {
        _bioSet = BIO_KEYWORDS.map(function(k) { return k.toLowerCase(); });
    }

    function _isBioClass(className) {
        if (!_bioSet) _initBioSet();
        var cn = className.toLowerCase();
        for (var i = 0; i < _bioSet.length; i++) {
            if (cn.indexOf(_bioSet[i]) !== -1) return true;
        }
        return false;
    }

    function _greenScore(canvas) {
        var s = 16;
        var tmp = document.createElement('canvas');
        tmp.width = s; tmp.height = s;
        var ctx = tmp.getContext('2d');
        ctx.drawImage(canvas, 0, 0, s, s);
        var data = ctx.getImageData(0, 0, s, s).data;
        var gc = 0, total = s * s;
        for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i+1], b = data[i+2];
            if (g > r && g > b && g > 40 && (g - r) > 15) gc++;
        }
        return gc / total;
    }

    return {
        get available() { return _available; },
        get stats() { return Object.assign({}, _stats); },

        init: function() {
            if (_loading) return Promise.resolve(false);
            _loading = true;
            _initBioSet();
            _lastGeminiTime = Date.now();

            return new Promise(function(resolve) {
                if (typeof mobilenet === 'undefined' || typeof tf === 'undefined') {
                    console.warn('[BioPrescreen] TF.js or MobileNet not loaded');
                    _loading = false;
                    resolve(false);
                    return;
                }

                tf.ready().then(function() {
                    return mobilenet.load({ version: 2, alpha: 0.5 });
                }).then(function(model) {
                    _model = model;
                    _available = true;
                    _loading = false;
                    console.log('[BioPrescreen] Ready (backend: ' + tf.getBackend() + ')');
                    resolve(true);
                }).catch(function(e) {
                    console.warn('[BioPrescreen] Load failed:', e.message);
                    _loading = false;
                    resolve(false);
                });
            });
        },

        /**
         * analyze — フレームを分析して Gemini が必要かを判定
         *
         * 返り値:
         *   needGemini: true → Gemini API を呼ぶ（新種・不明・定期サンプリング）
         *   needGemini: false → MobileNet 結果をローカル記録のみ
         *   localDetections: MobileNet が検出した生物クラスの配列（常に返る）
         */
        analyze: function(canvas) {
            _stats.total++;

            if (!_available || !_model) {
                _stats.geminiCalls++;
                return Promise.resolve({
                    needGemini: true,
                    localDetections: [],
                    reason: 'no-model'
                });
            }

            var now = Date.now();

            return _model.classify(canvas, 10).then(function(predictions) {
                var bioDetections = [];
                var hasNewClass = false;

                for (var i = 0; i < predictions.length; i++) {
                    var p = predictions[i];
                    if (_isBioClass(p.className) && p.probability >= 0.05) {
                        bioDetections.push({
                            className: p.className,
                            probability: p.probability,
                            isNew: !_knownClasses[p.className]
                        });
                        if (!_knownClasses[p.className]) {
                            hasNewClass = true;
                            _knownClasses[p.className] = { firstSeen: now, count: 0 };
                        }
                        _knownClasses[p.className].count++;
                        _knownClasses[p.className].lastSeen = now;
                    }
                }

                var gScore = _greenScore(canvas);
                var timeSinceLastGemini = now - _lastGeminiTime;
                var isSampleTime = timeSinceLastGemini >= GEMINI_SAMPLE_INTERVAL;

                // Gemini を呼ぶ条件:
                // 1. MobileNet で新しいクラスが出た → 和名・noteを取得
                // 2. 生物検出なし & 緑が多い → MobileNet が見逃した植物の可能性
                // 3. 定期サンプリング(30秒) → 環境変化の確認
                var needGemini = hasNewClass
                    || (bioDetections.length === 0 && gScore > 0.25)
                    || isSampleTime;

                if (needGemini) {
                    _lastGeminiTime = now;
                    _stats.geminiCalls++;
                } else {
                    _stats.localOnly++;
                }

                return {
                    needGemini: needGemini,
                    localDetections: bioDetections,
                    greenScore: gScore,
                    reason: hasNewClass ? 'new-class' : isSampleTime ? 'sample' : (gScore > 0.25 ? 'green-check' : 'local-only')
                };
            }).catch(function(e) {
                console.warn('[BioPrescreen] Inference error:', e.message);
                _stats.geminiCalls++;
                return { needGemini: true, localDetections: [], reason: 'error' };
            });
        },

        /**
         * Gemini の結果を MobileNet クラスと紐付けて学習
         * 次回同じ MobileNet クラスが出た時、Gemini なしでローカル記録できる
         */
        learnFromGemini: function(mobilenetClasses, geminiResults) {
            if (!geminiResults || !geminiResults.length) return;
            for (var i = 0; i < mobilenetClasses.length; i++) {
                var mc = mobilenetClasses[i];
                if (_knownClasses[mc]) {
                    _knownClasses[mc].geminiMapping = geminiResults;
                }
            }
        },

        getGeminiSaveRate: function() {
            return _stats.total > 0 ? Math.round((_stats.localOnly / _stats.total) * 100) : 0;
        },

        getKnownClasses: function() {
            return Object.assign({}, _knownClasses);
        },

        destroy: function() {
            if (_model) { _model = null; _available = false; }
            _knownClasses = {};
        }
    };
})();
