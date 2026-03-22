/**
 * BioPrescreen — TF.js MobileNet V2 による生物プレスクリーニング
 *
 * ライブスキャンで「生物がいそうなフレーム」だけ Gemini API に送る。
 * 空・建物・アスファルト・人物のフレームをスキップし、API コストを ~60% 削減。
 */
var BioPrescreen = (function() {
    'use strict';

    var _model = null;
    var _available = false;
    var _loading = false;
    var _consecutiveSkips = 0;
    var _stats = { total: 0, skipped: 0, sent: 0 };

    // ImageNet の生物関連キーワード（MobileNet classify の className に部分一致）
    // 偽陰性最小化のため、広めに設定
    var BIO_KEYWORDS = [
        // 鳥類
        'cock', 'hen', 'ostrich', 'brambling', 'goldfinch', 'bunting', 'robin', 'bulbul',
        'jay', 'magpie', 'chickadee', 'dipper', 'kite', 'eagle', 'vulture', 'buzzard',
        'owl', 'grouse', 'peacock', 'quail', 'partridge', 'macaw', 'lorikeet', 'coucal',
        'bee eater', 'hornbill', 'hummingbird', 'jacamar', 'toucan', 'drake', 'goose',
        'penguin', 'albatross', 'pelican', 'king penguin', 'flamingo', 'crane', 'bustard',
        'bittern', 'spoonbill', 'stork', 'ibis', 'heron', 'limpkin', 'oystercatcher',
        'bird', 'parrot', 'finch', 'sparrow', 'warbler', 'wren', 'pigeon',
        // 魚類
        'tench', 'goldfish', 'shark', 'ray', 'eel', 'coho', 'fish', 'barracouta',
        'lionfish', 'puffer', 'sturgeon', 'gar', 'anemone fish', 'clownfish',
        // 爬虫類・両生類
        'newt', 'salamander', 'frog', 'toad', 'tree frog', 'bullfrog',
        'turtle', 'terrapin', 'mud turtle', 'box turtle', 'leatherback',
        'iguana', 'chameleon', 'agama', 'frilled lizard', 'alligator lizard',
        'gila monster', 'green lizard', 'gecko', 'whiptail', 'nile crocodile',
        'alligator', 'triceratops', 'snake', 'cobra', 'mamba', 'diamondback',
        'sidewinder', 'horned viper', 'boa', 'rock python', 'king snake',
        'garter snake', 'vine snake', 'night snake', 'thunder snake',
        'ringneck', 'hognose', 'green snake',
        // 哺乳類
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
        'tabby', 'egyptian cat', 'cougar',
        // 昆虫・クモ
        'bee', 'wasp', 'ant', 'butterfly', 'moth', 'beetle', 'ladybug',
        'weevil', 'fly', 'dragonfly', 'damselfly', 'cricket', 'grasshopper',
        'cockroach', 'mantis', 'cicada', 'leafhopper', 'lacewing',
        'spider', 'tarantula', 'scorpion', 'tick', 'centipede', 'millipede',
        'monarch', 'cabbage butterfly', 'sulphur butterfly', 'lycaenid',
        'admiral', 'ringlet', 'leaf beetle', 'long-horned beetle',
        'dung beetle', 'rhinoceros beetle', 'ground beetle',
        // 海洋・水生
        'jellyfish', 'sea anemone', 'coral', 'starfish', 'sea urchin',
        'sea cucumber', 'sea slug', 'nautilus', 'crab', 'lobster',
        'crayfish', 'hermit crab', 'isopod', 'snail', 'slug', 'conch',
        'trilobite', 'octopus', 'squid',
        // 植物・菌類
        'mushroom', 'agaric', 'stinkhorn', 'earthstar', 'hen-of-the-woods',
        'bolete', 'gyromitra', 'coral fungus',
        'daisy', 'sunflower', 'dandelion', 'rose', 'poppy', 'lily',
        'tulip', 'orchid', 'iris', 'lotus', 'pot', 'flowerpot',
        'acorn', 'hip', 'ear', 'rapeseed', 'corn',
        // 食べ物（生物由来）
        'banana', 'pineapple', 'strawberry', 'orange', 'lemon', 'fig',
        'pomegranate', 'jackfruit', 'custard apple', 'guacamole',
        // その他の生物
        'worm', 'nematode', 'flatworm', 'leech',
    ];

    // キーワードセット（小文字、部分一致で検索）
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

    // 緑色ヒューリスティック: 植物が多い場面を検出
    function _greenScore(canvas) {
        var sampleSize = 16;
        var tmpC = document.createElement('canvas');
        tmpC.width = sampleSize;
        tmpC.height = sampleSize;
        var ctx = tmpC.getContext('2d');
        ctx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
        var data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        var greenCount = 0;
        var total = sampleSize * sampleSize;

        for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i+1], b = data[i+2];
            // 簡易緑色判定: G が R と B の両方より大きく、G > 40
            if (g > r && g > b && g > 40 && (g - r) > 15) {
                greenCount++;
            }
        }
        return greenCount / total;
    }

    return {
        get available() { return _available; },
        get stats() { return Object.assign({}, _stats); },

        init: function() {
            if (_loading) return Promise.resolve(false);
            _loading = true;
            _initBioSet();

            return new Promise(function(resolve) {
                if (typeof mobilenet === 'undefined' || typeof tf === 'undefined') {
                    console.warn('[BioPrescreen] TF.js or MobileNet not loaded');
                    _loading = false;
                    resolve(false);
                    return;
                }

                // WebGL バックエンド使用確認
                tf.ready().then(function() {
                    return mobilenet.load({ version: 2, alpha: 0.5 }); // 軽量版 (alpha=0.5 → ~1.7MB)
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

        prescreen: function(canvas) {
            _stats.total++;

            if (!_available || !_model) {
                _stats.sent++;
                return Promise.resolve({ shouldSend: true, bioScore: 1, greenScore: 0, reason: 'no-model' });
            }

            return _model.classify(canvas, 10).then(function(predictions) {
                var bioScore = 0;
                var topBioClass = '';

                for (var i = 0; i < predictions.length; i++) {
                    if (_isBioClass(predictions[i].className)) {
                        bioScore += predictions[i].probability;
                        if (!topBioClass) topBioClass = predictions[i].className;
                    }
                }

                var gScore = _greenScore(canvas);
                var combined = Math.max(bioScore, gScore * 0.5);
                var forceByStreak = _consecutiveSkips >= 10;
                var shouldSend = combined >= 0.08 || forceByStreak;

                if (shouldSend) {
                    _consecutiveSkips = 0;
                    _stats.sent++;
                } else {
                    _consecutiveSkips++;
                    _stats.skipped++;
                }

                return {
                    shouldSend: shouldSend,
                    bioScore: bioScore,
                    greenScore: gScore,
                    topBioClass: topBioClass,
                    reason: forceByStreak ? 'force-streak' : (shouldSend ? 'bio-detected' : 'skip')
                };
            }).catch(function(e) {
                console.warn('[BioPrescreen] Inference error:', e.message);
                _stats.sent++;
                return { shouldSend: true, bioScore: 0, greenScore: 0, reason: 'error' };
            });
        },

        getSkipRate: function() {
            return _stats.total > 0 ? Math.round((_stats.skipped / _stats.total) * 100) : 0;
        },

        destroy: function() {
            if (_model) {
                _model = null;
                _available = false;
            }
        }
    };
})();
