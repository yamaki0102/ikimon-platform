<div class="flex-1 overflow-y-auto p-8">
    <h1 class="text-3xl font-bold mb-8">レポート出力</h1>

    <!-- Report Generator -->
    <div class="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 class="text-xl font-bold mb-4">新規レポート作成</h2>
        <div class="space-y-6 max-w-2xl">
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">対象エリア</label>
                <select class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none">
                    <option value="all">全エリア</option>
                    <option value="park">佐鳴湖公園 北岸エリア</option>
                    <option value="private">企業敷地A</option>
                </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-400 block mb-2">期間選択</label>
                    <select class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white">
                        <option>直近30日</option>
                        <option>直近90日</option>
                        <option>今年度</option>
                        <option>カスタム期間</option>
                    </select>
                </div>
                <div>
                    <label class="text-sm text-gray-400 block mb-2">フォーマット</label>
                    <select id="report-format" class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white" onchange="toggleReportDescription()">
                        <option value="env">環境省認定様式</option>
                        <option value="credit">クレジット・自然共生サイト向け参考レポート（観察データ版）</option>
                        <option value="pdf">PDF (詳細版)</option>
                        <option value="excel">Excel (データ一覧)</option>
                    </select>
                </div>
            </div>

            <!-- Description for Credit Report -->
            <div id="credit-report-desc" class="hidden bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-sm text-gray-300">
                <div class="font-bold text-green-400 mb-2 flex items-center gap-2">
                    <i data-lucide="info" class="w-4 h-4"></i>
                    クレジット・自然共生サイト向け参考レポート（観察データ版）
                </div>
                <p class="mb-2 text-xs">
                    観察データのみを用いた、生物多様性クレジット・自然共生サイト向けの参考レポートです。正式なクレジット算定前の「たたき台」や社内共有用としてご利用いただけます。
                </p>
                <ul class="list-disc list-inside text-xs text-gray-400 pl-2 space-y-1">
                    <li>種多様性インデックスの推移</li>
                    <li>保全重要種（レッドリスト等）の確認状況</li>
                    <li>外来種比率の推移</li>
                </ul>
            </div>

            <button class="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-2">
                <i data-lucide="download" class="w-5 h-5"></i>
                レポートを生成
            </button>
        </div>
    </div>

    <!-- Download History -->
    <div class="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 class="text-xl font-bold mb-4">ダウンロード履歴</h2>
        <div class="space-y-3">
            <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                    <div class="font-bold">2024年度　第2四半期レポート</div>
                    <div class="text-sm text-gray-400">環境省認定様式 • 2024/11/15</div>
                </div>
                <button class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition">再ダウンロード</button>
            </div>
        </div>
    </div>
</div>

<script>
function toggleReportDescription() {
    const select = document.getElementById('report-format');
    const desc = document.getElementById('credit-report-desc');
    if (select.value === 'credit') {
        desc.classList.remove('hidden');
    } else {
        desc.classList.add('hidden');
    }
}
</script>
