#!/bin/bash
# ============================================
# ミニアイ タスク実行ランチャー
# 愛 (Sunpu Strategist) が発行したタスクを順次実行
# ============================================

echo "🔧 ミニアイ起動中..."
cd /home/yamaki/projects/ikimon-platform

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 タスク1: BINGOデプロイ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
antigravity chat "TASK_BRIEF_BINGO_DEPLOY.md を読んで、手順通りに全て実行して。完了したら結果を報告して。"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 タスク2: オモイカネ監視・回復"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
antigravity chat "TASK_BRIEF_OMOIKANE_WORKER.md の内容を読んで、手順通りに全て実行して。外部APIは禁止。ローカルのPHPスクリプトとOllamaのみ使用すること。"

echo ""
echo "✅ 全タスク完了！愛に結果を報告してね。"
