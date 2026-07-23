まず対象パケットと参照実装を実際に読みます。

The packet references files in `platform_v2/`, but the packet itself lives in a recovery worktree. Let me locate the actual implementation files.

`​`​`

Let me read the packet and find the real repo paths.


{"name": "Read", "input": {"file_path": "E:\\Projects\\_agent_scratch\\yamaki0102-ikimon-platform\\home-empty-recovery-20260724\\repo\\operations\\ai_os\\ikimon_home_top_profile_review_packet_20260724.md"}}

system USD budget: $0/$3; $3 remaining

result     1→# ikimon.life Top / Home / My Page 改善レビュー packet
     2→
     3→## 目的
     4→
     5→ikimon.life を「地域の記録を、みんなで育てる」サービスとして、撮影後も自分・場所・次の活動へつながる入口にする。自社運営・同意ベースの公開サービスとして、位置・学校・子ども・自宅・私有地・希少な対象の安全側設計を維持する。
     6→
     7→## 今回の設計判断
     8→
     9→### 未ログイン Top
    10→
    11→- ファーストビューは「地域の記録を、みんなで育てる。」と「撮る」「場所を見る」に絞る。
    12→- 写真は、公開可能な投稿写真が取得できるときは投稿写真を優先する。
    13→- データが空・取得不能でも色付きダミーへ戻さず、専用に生成した写真を使う。
    14→- 生成写真は「学校・学び」「地域・イベント」「仕事・文化」「暮らし・自然」の4分類に一対一で対応させる。
    15→- 生成写真は文字・ロゴ・識別可能な顔を含めず、投稿写真であるかのような説明を付けない。
    16→- 自然だけのサービスに見せず、写真・場所・時間・気づきを残す共通体験を示す。
    17→
    18→### ログイン後 Home
    19→
    20→- 汎用的な「今日は何を残しますか？」カードや機能一覧を主役にしない。
    21→- 本人に記録がある場合は、最新の写真を「この前の記録」として最上部に置く。
    22→- 最上部の次行動は「この記録を見る」と、共通カメラ処理を呼ぶ「今日の記録を撮る」。
    23→- 続いて本人の最近の記録を最大6件、写真中心で表示する。
    24→- AI候補、内部処理状態、公開フィードはHomeの主役にしない。
    25→- その後に「場所から見つける」を置き、記録のある場所と次の活動へつなぐ。
    26→- 本人の記録が0件の場合だけ、撮影・明示的な端末画像選択・場所の3行動をコンパクトに示す。
    27→
    28→### My Page
    29→
    30→- Homeの写真一覧を複製しない。
    31→- 「プロフィールと公開ページ」「公開範囲と位置情報」「参加とフォロー」「アカウント設定」を扱う自己管理面にする。
    32→- ログアウトはGETリンクではなくPOSTフォームを維持する。
    33→
    34→## 根本原因
    35→
    36→正本のHome HTMLは事前生成され、Cloudflare Workerが認証後に本人データを差し込む構成だった。しかし正本HTMLから差し込みマーカーが欠落していた一方、Workerテストは手書きテンプレートを使っていたため契約ずれを検知できなかった。本人データ取得は成功していても差し込みが行われず、事前生成された初回ユーザー向けカードと大きな空白だけが残っていた。
    37→
    38→## 実装接続点
    39→
    40→- 正本UI: `platform_v2/src/ui/landingHomeState.ts`
    41→- 正本コピー/i18n: `platform_v2/src/content/short/*/public.json`, `platform_v2/src/i18n/strings.ts`
    42→- Worker差し込み: `platform_v2/cloudflare_shadow/src/index.ts`
    43→- 静的画像materialize: `platform_v2/cloudflare_shadow/scripts/materialize-original-ui-html.mjs`
    54→- 画像配信: `platform_v2/src/routes/legacyAssets.ts`, WorkerのR2静的配信
    45→
    46→## 参照した外部パターンと採用範囲
    47→
    48→- Google Photos / Amazon Photos: 再訪時は機能一覧より「思い出・最近の写真」を先に出す。
    49→- Apple共有写真ライブラリ / Amazon Family Vault: 個人領域と共有領域を混ぜず、共有状態を本人が確認できる。
    50→- Google Maps投稿導線: 過去の貢献と場所の次行動をつなぐ。ただし公開前提や位置公開の考え方は採用しない。
    51→
    52→## 検証済み
    53→
    54→- 正本Top/Home/My Page/画像配信の対象テスト: 29件 green
    55→- Worker Home契約テスト: 2件 green
    56→- Worker全テスト: 217件 green
    57→- TypeScript型検査: platform / Workerともgreen
    58→- 390px / 1440pxのTopを目視し、文字かぶり・CTA見切れ・画像欠落なし
    59→
    60→## レビューしてほしい論点
    61→
    62→- Homeの「最後の1枚 → 今日撮る → 最近の記録 → 場所」が、再訪行動を生む順序として妥当か。
    63→- 記録0件時に撮る・端末から選ぶ・場所の3行動を出すことが過剰でないか。
    64→- HomeとMy Pageの役割分離に欠落がないか。
    65→- 生成写真と投稿写真の使い分けが誤認・信頼低下を生まないか。
    66→- 位置、学校・子ども、自宅、私有地、希少対象に対する防御的セーフガードを弱めていないか。
    67→- 今回の範囲で本番反映を止めるべきP0/P1問題があるか。拡張案ではなく、修正が必要な具体点を優先してほしい。
    58→
    59→
