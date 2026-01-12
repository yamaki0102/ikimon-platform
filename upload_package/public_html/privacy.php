<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>プライバシーポリシー - ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-8">プライバシーポリシー</h1>
            <p class="text-sm text-gray-400 mb-8">最終更新日: 2025年1月1日</p>
            
            <article class="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300">
                
                <section>
                    <h2 class="text-xl font-bold text-white mb-4">1. はじめに</h2>
                    <p>
                        ikimon Project（以下「当プロジェクト」）は、ユーザーの皆様のプライバシーを尊重し、個人情報の保護に努めています。本ポリシーは、当プロジェクトがどのような情報を収集し、どのように使用・保護するかを説明するものです。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">2. 収集する情報</h2>
                    
                    <h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">2.1 ユーザーが提供する情報</h3>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>アカウント情報</strong>: ユーザー名、メールアドレス、パスワード</li>
                        <li><strong>投稿データ</strong>: 写真、位置情報、観察日時、コメント</li>
                        <li><strong>同定情報</strong>: 生物名、同定の根拠</li>
                    </ul>
                    
                    <h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">2.2 自動収集される情報</h3>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>アクセスログ</strong>: IPアドレス、ブラウザ情報、アクセス日時</li>
                        <li><strong>利用状況</strong>: ページビュー、滞在時間、クリックデータ</li>
                        <li><strong>デバイス情報</strong>: 端末の種類、OS、画面サイズ</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">3. 情報の利用目的</h2>
                    <p>収集した情報は、以下の目的で使用します：</p>
                    <ul class="list-disc list-inside space-y-2 mt-2">
                        <li>本サービスの提供・改善</li>
                        <li>ユーザーサポートの提供</li>
                        <li>生物多様性データの可視化・分析</li>
                        <li>研究目的でのデータ提供（匿名化処理後）</li>
                        <li>サービスに関するお知らせの送信</li>
                        <li>不正利用の防止</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">4. 位置情報の取り扱い</h2>
                    <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 mb-4">
                        <p class="text-yellow-300 font-bold">⚠️ 重要</p>
                    </div>
                    <ul class="list-disc list-inside space-y-2">
                        <li>投稿時の位置情報は、観察地点として公開されます。</li>
                        <li>自宅等のプライベートな場所での投稿はお控えください。</li>
                        <li><strong>EXIF削除</strong>: アップロードされた写真からは、位置情報を含むEXIFメタデータを自動的に削除しています。</li>
                        <li><strong>希少種保護</strong>: 絶滅危惧種の位置は公開時に精度を下げます（約1km単位）。</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">5. 第三者提供</h2>
                    <p>当プロジェクトは、以下の場合を除き、個人を特定できる情報を第三者に提供しません：</p>
                    <ul class="list-disc list-inside space-y-2 mt-2">
                        <li>ユーザーの同意がある場合</li>
                        <li>法令に基づく開示要請があった場合</li>
                        <li>生命・財産の保護のため緊急に必要な場合</li>
                    </ul>
                    <p class="mt-4">
                        <strong>オープンデータについて</strong>: 匿名化された観察データ（Research Grade）は、GBIF等のオープンデータプラットフォームに提供される場合があります。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">6. データの保管と安全管理</h2>
                    <ul class="list-disc list-inside space-y-2">
                        <li>データは日本国内のサーバーに保管されます。</li>
                        <li>SSL/TLS暗号化により通信を保護しています。</li>
                        <li>パスワードはハッシュ化して保存します。</li>
                        <li>定期的なセキュリティ監査を実施しています。</li>
                    </ul>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">7. Cookie（クッキー）の使用</h2>
                    <p>当サービスでは、以下の目的でCookieを使用します：</p>
                    <ul class="list-disc list-inside space-y-2 mt-2">
                        <li><strong>必須Cookie</strong>: ログイン状態の維持、セキュリティ対策</li>
                        <li><strong>機能Cookie</strong>: ユーザー設定の保存</li>
                        <li><strong>分析Cookie</strong>: サービス改善のためのアクセス解析</li>
                    </ul>
                    <p class="mt-4">
                        ブラウザの設定でCookieを無効にできますが、一部機能が利用できなくなる場合があります。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">8. ユーザーの権利</h2>
                    <p>ユーザーには以下の権利があります：</p>
                    <ul class="list-disc list-inside space-y-2 mt-2">
                        <li><strong>アクセス権</strong>: 保有する個人情報の開示を求める権利</li>
                        <li><strong>訂正権</strong>: 不正確な情報の訂正を求める権利</li>
                        <li><strong>削除権</strong>: 個人情報の削除を求める権利</li>
                        <li><strong>制限権</strong>: 処理の制限を求める権利</li>
                    </ul>
                    <p class="mt-4">
                        これらの権利行使を希望される場合は、下記のお問い合わせ先までご連絡ください。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">9. 未成年者のプライバシー</h2>
                    <p>
                        16歳未満の方が本サービスを利用する場合は、保護者の同意を得た上でご利用ください。16歳未満の方から意図せず個人情報を収集したことが判明した場合、速やかに削除いたします。
                    </p>
                </section>

                <section>
                    <h2 class="text-xl font-bold text-white mb-4">10. ポリシーの変更</h2>
                    <p>
                        本ポリシーは、法令の改正やサービス内容の変更に伴い、予告なく変更されることがあります。重要な変更があった場合は、本サービス上でお知らせします。
                    </p>
                </section>

                <section class="pt-8 border-t border-white/10">
                    <h2 class="text-xl font-bold text-white mb-4">お問い合わせ</h2>
                    <p>
                        プライバシーに関するお問い合わせは、下記までご連絡ください。<br><br>
                        <strong>ikimon Project</strong><br>
                        Email: <a href="mailto:privacy@ikimon.life" class="text-[var(--color-primary)] hover:underline">privacy@ikimon.life</a><br>
                        所在地: 静岡県浜松市
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
