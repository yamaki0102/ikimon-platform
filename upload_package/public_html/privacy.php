<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "プライバシーポリシー — ikimon.life";
    $meta_description = "ikimon.life のプライバシーポリシー。位置情報、写真データ、個人情報の取り扱いについて。";
    include __DIR__ . '/components/meta.php';
    ?>
</head>

<body class="bg-base text-text font-body">
    <?php include __DIR__ . '/components/header.php'; ?>

    <main class="max-w-3xl mx-auto px-4 pt-24 pb-20 md:pt-28">

        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-text mb-2">🔒 プライバシーポリシー</h1>
        <p class="text-xs text-muted mb-8">最終更新日: 2026年2月20日</p>

        <div class="space-y-8 text-sm text-text leading-relaxed">

            <section>
                <h2 class="text-lg font-black text-text mb-3">1. 収集する情報</h2>
                <p>本サービスでは、以下の情報を収集します。</p>

                <h3 class="font-bold text-text mt-4 mb-2">1.1 アカウント情報</h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>Google アカウント名、メールアドレス、プロフィール画像（Google認証利用時）</li>
                    <li>ゲストユーザーの場合は一時的な識別子のみ</li>
                </ul>

                <h3 class="font-bold text-text mt-4 mb-2">1.2 観察データ</h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>写真（EXIF データを含む場合があります）</li>
                    <li>GPS 座標（緯度・経度）</li>
                    <li>観察日時</li>
                    <li>メモ・コメント</li>
                    <li>選択されたライセンス種別</li>
                </ul>

                <h3 class="font-bold text-text mt-4 mb-2">1.3 利用データ</h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時）</li>
                    <li>API リクエストログ（有料プラン利用者）</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">2. 情報の利用目的</h2>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>サービスの提供・運営・改善</li>
                    <li>コミュニティによる生物同定の支援</li>
                    <li>生物多様性データの科学的利用（GBIF等への共有）</li>
                    <li>不正利用の防止・セキュリティの確保</li>
                    <li>利用状況の分析・統計の作成</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">3. 位置情報の取り扱い</h2>
                <div class="bg-secondary/5 border border-secondary/20 rounded-2xl p-5 mb-3">
                    <p class="font-bold text-text mb-2">🛡️ 絶滅危惧種の位置情報保護</p>
                    <p class="text-muted">環境省レッドリストおよび都道府県レッドリストに掲載されている種の位置情報は、<strong class="text-text">自動的にランダム化</strong>（半径10km圏内）されます。これは密猟防止のための措置であり、ユーザーが解除することはできません。</p>
                </div>
                <p>通常の観察記録の位置情報は、投稿者が選択したライセンスに基づき公開されます。位置情報を共有したくない場合は、投稿前に手動で位置を調整してください。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">4. EXIF データの取り扱い</h2>
                <p>写真に含まれる EXIF データ（撮影日時、GPS 座標、カメラ機種等）は、データ品質の検証に利用します。EXIF に含まれる GPS 座標と投稿時の位置情報を照合し、データの信頼性を評価します。</p>
                <p class="mt-2">公開写真からは EXIF の GPS 情報は除去されます。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">5. データの第三者提供</h2>
                <p>以下の場合に限り、収集したデータを第三者に提供します。</p>
                <ul class="list-disc list-inside space-y-1 text-muted mt-2">
                    <li><strong class="text-text">GBIF への共有</strong>: CC0 または CC BY ライセンスの研究グレードデータのみ</li>
                    <li><strong class="text-text">API 経由の提供</strong>: 有料プラン契約者に対し、投稿者が選択したライセンスの範囲内で</li>
                    <li><strong class="text-text">法的要請</strong>: 法令に基づく開示要請があった場合</li>
                </ul>
                <p class="mt-2"><strong>CC BY-NC ライセンスのデータは GBIF には共有されません。</strong></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">6. データの保存</h2>
                <p>観察データは、サービスの運営期間中、日本国内のサーバーに保存されます。アカウント削除を希望する場合は、contact@ikimon.life までご連絡ください。</p>
                <p class="mt-2">ただし、既に GBIF 等の外部データベースに共有されたデータについては、削除のリクエストを外部機関に転送しますが、完全な削除を保証することはできません。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">7. Cookie の使用</h2>
                <p>本サービスでは、セッション管理と CSRF 保護のために以下の Cookie を使用します。</p>
                <ul class="list-disc list-inside space-y-1 text-muted mt-2">
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">PHPSESSID</code> — セッション管理</li>
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">ikimon_csrf</code> — CSRF トークン（セキュリティ）</li>
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">ikimon_guest_id</code> — ゲストユーザー識別</li>
                </ul>
                <p class="mt-2">広告目的の Cookie やトラッキング Cookie は一切使用しません。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">8. お問い合わせ</h2>
                <p>プライバシーに関するお問い合わせは、以下にご連絡ください。</p>
                <div class="bg-surface border border-border rounded-2xl p-4 mt-3">
                    <p class="font-bold text-text">ikimon.life 運営事務局</p>
                    <p class="text-muted mt-1">📧 <a href="mailto:contact@ikimon.life" class="text-primary underline">contact@ikimon.life</a></p>
                </div>
            </section>

        </div>

        <!-- Related Links -->
        <div class="flex flex-wrap gap-3 mt-10 pt-6 border-t border-border">
            <a href="terms.php" class="text-xs font-bold text-primary hover:underline">📜 利用規約</a>
            <a href="faq.php" class="text-xs font-bold text-primary hover:underline">❓ よくある質問</a>
            <a href="pricing.php" class="text-xs font-bold text-primary hover:underline">💰 料金プラン</a>
        </div>

    </main>

    <?php include __DIR__ . '/components/footer_nav.php'; ?>
    <script>
        lucide.createIcons();
    </script>
</body>

</html>