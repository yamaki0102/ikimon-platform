<?php
require_once __DIR__ . '/../libs/GlossaryHelper.php';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>用語解説テスト</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 p-6">
<?php echo GlossaryHelper::renderCSS(); ?>
<div class="max-w-lg mx-auto space-y-4 bg-white rounded-2xl border p-4 shadow-sm">
    <h2 class="text-lg font-bold">AI考察テスト</h2>
    <p class="text-sm leading-relaxed">
        <?php echo GlossaryHelper::annotate(htmlspecialchars('写真から見ると、科レベルでシジュウカラ科にかなり近そうです。翅の斑紋と嘴の形状が手がかりになっています。')); ?>
    </p>
    <div class="rounded-xl border bg-gray-50 p-3">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">写真から拾えている手がかり</p>
        <p class="text-sm"><?php echo GlossaryHelper::annotate(htmlspecialchars('触角の形質 / 鞘翅の点刻パターン / 前胸背板の形状')); ?></p>
    </div>
    <div class="rounded-xl border bg-gray-50 p-3">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ここで止めておく理由</p>
        <p class="text-sm text-gray-500"><?php echo GlossaryHelper::annotate(htmlspecialchars('花弁と萼片の識別形質が写真からは確認しにくく、属レベルでの同定が限界です。')); ?></p>
    </div>
    <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">この観察ですでに助かるところ</p>
        <p class="text-sm text-emerald-800"><?php echo GlossaryHelper::annotate(htmlspecialchars('在来種の生息地の植生がよく写っており、生物多様性の記録として価値があります。')); ?></p>
    </div>
    <div class="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
        <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">次にあると絞りやすいもの</p>
        <p class="text-sm text-sky-800"><?php echo GlossaryHelper::annotate(htmlspecialchars('葉脈のパターンと鋸歯の形が分かる写真があると、種まで絞りやすくなります。')); ?></p>
    </div>
</div>
</body>
</html>
