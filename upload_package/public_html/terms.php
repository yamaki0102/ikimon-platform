<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>利用規約 - ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-8">利用規約</h1>
            <p class="text-sm text-gray-400 mb-8">最終更新日: 2025年1月1日</p>
            
            <article class="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300">
                
                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第1条（適用）</h2>
                    <p>
                        本規約は、ikimon Project（以下「当プロジェクト」）が提供するサービス「ikimon」（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様は、本規約に同意の上、本サービスをご利用ください。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第2条（定義）</h2>
                    <ul class="list-disc list-inside space-y-2">
                        <li>「ユーザー」とは、本サービスを利用するすべての方を指します。</li>
                        <li>「投稿データ」とは、ユーザーが本サービスに投稿した写真、位置情報、テキスト等のコンテンツを指します。</li>
                        <li>「観察データ」とは、投稿データから生成される生物観察レコードを指します。</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第3条（利用登録）</h2>
                    <p>
                        本サービスの一部機能は登録なしでご利用いただけます。ただし、投稿機能、同定機能等の利用には、利用登録が必要です。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第4条（投稿データの取り扱い）</h2>
                    <ul class="list-disc list-inside space-y-2">
                        <li>投稿データの著作権は、原則としてユーザーに帰属します。</li>
                        <li>ユーザーは、当プロジェクトに対し、投稿データを本サービスの提供・改善・研究目的で使用する非独占的ライセンスを付与します。</li>
                        <li><strong>オープンデータ化</strong>: 投稿データのうち、専門家による検証を経た「Research Grade」データは、CC BY-NC（表示-非営利）ライセンスでGBIF等のオープンデータプラットフォームに公開される場合があります。</li>
                        <li>絶滅危惧種の位置情報は、保護のため自動的に精度を下げて公開されます。</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第5条（禁止事項）</h2>
                    <p>ユーザーは、以下の行為を行ってはなりません：</p>
                    <ul class="list-disc list-inside space-y-2 mt-2">
                        <li>虚偽の情報を投稿する行為</li>
                        <li>他者の著作権、プライバシー権を侵害する行為</li>
                        <li>法令または公序良俗に反する行為</li>
                        <li>本サービスの運営を妨害する行為</li>
                        <li>商業目的での無断利用</li>
                        <li>不正アクセス、スクレイピング等の行為</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第6条（サービスの変更・停止）</h2>
                    <p>
                        当プロジェクトは、事前の通知なく本サービスの内容を変更、または提供を停止することがあります。これによりユーザーに生じた損害について、当プロジェクトは責任を負いません。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第7条（免責事項）</h2>
                    <ul class="list-disc list-inside space-y-2">
                        <li>本サービスで提供される生物情報は参考情報であり、正確性を保証するものではありません。</li>
                        <li>毒性、危険性のある生物については、専門家の判断を得た上で対応してください。</li>
                        <li>本サービスの利用により生じた損害について、当プロジェクトは一切の責任を負いません。</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">第8条（準拠法・管轄）</h2>
                    <p>
                        本規約の解釈には日本法が適用されます。本サービスに関する紛争については、静岡地方裁判所を第一審の専属的合意管轄裁判所とします。
                    </p>
                </section>

                <section class="pt-8 border-t border-white/10">
                    <h2 class="text-xl font-bold text-white mb-4">お問い合わせ</h2>
                    <p>
                        本規約に関するお問い合わせは、下記までご連絡ください。<br>
                        Email: <a href="mailto:contact@ikimon.life" class="text-[var(--color-primary)] hover:underline">contact@ikimon.life</a>
                    </p>
                </section>

            </article>
        </div>
    </section>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
