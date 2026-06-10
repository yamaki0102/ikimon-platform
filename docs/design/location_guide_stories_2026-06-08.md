# Location Guide Stories

Date: 2026-06-08

## Decision

ikimon.life のガイド機能は、ゲーム的な目的地誘導ではなく、承認済みの場所ストーリーとして始める。

初期実装は `/map` のエリア詳細に `guide_stop` を表示し、ブラウザの Geolocation API で現地に近いかを確認する。範囲内であれば Web Speech API で本文を読み上げる。誰でも表示できるが、登録データは土地管理者・steward・運営確認済みの `observation_fields.payload.guide_stop` から出す。

## Research Inputs

- Yamaha SoundUD / おもてなしガイド: GPS、音響通信、QR/NFC などのトリガーで、場所にいる利用者へ音声・テキストを届ける設計。 https://www.yamaha.com/ja/news_release/2023/23022201/
- Yamaha Expo accessibility guidance: QR/NFC と多言語テキスト・音声の併用。 https://www.yamaha.com/ja/news_release/2024/24060501/
- Guideius: QR、GPS trigger、offline、multilingual、analytics を備える文化施設向け音声ガイド。 https://www.guideius.com/en/
- SonicMaps: geofence に音声・テキスト・画像を紐づけ、屋外ではGPSで自動再生する地図型サウンド体験。 https://sonicmaps.xyz/
- Situate: GPS hot spot radius、Bluetooth beacon、NFC、offline を使う visitor guide app。 https://situate.io/
- izi.TRAVEL: GPS / QR / number pad trigger を使う city and museum audio guide。 https://izi.travel/en/app?lang=en
- VoiceMap: self-guided audio tour with automatic GPS playback and offline support. https://voicemap.me/
- GuideAlong: GPS based auto-play audio tour, designed for road trips and parks. https://guidealong.com/
- SmartGuide: destination guide app with maps, audio/text, offline support, and official guide publishing. https://www.smartguide.app/
- MDN Geolocation API: secure context and explicit permission are required for browser location. https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

## Product Translation

Do:

- 地域とのつながりを作る「現地で聞ける物語」に寄せる。
- 管理者承認済みコンテンツだけを `guide_stop` として出す。
- 地図上では「あちらにある」ことは見せるが、再生は近接範囲内に限定する。
- 位置情報はブラウザを開いている間の `watchPosition` に限定する。
- QR/NFC は将来の現地サイン・看板での fallback として残す。

Do not:

- 初期版でバックグラウンド常時 geofencing を約束しない。
- 未承認の口コミやAI生成本文を現地ガイドとして出さない。
- 調査済みでない年数や施工期間を事実として本文に入れない。
- ゲームの報酬・ランキング・奪い合いを主軸にしない。

## Data Shape

`observation_fields.payload.guide_stop`

```json
{
  "enabled": true,
  "language": "ja",
  "title": "連理の木とLENRIの物語",
  "subtitle": "近づくと、愛管の自然共生サイトとLENRIがどう育ったかを聞けます。",
  "preview": "現地でつながる物語として紹介します。",
  "script": "読み上げ本文",
  "story_points": ["要点1", "要点2"],
  "trigger_radius_m": 90,
  "unlocked_radius_m": 55,
  "approved_by": "愛管株式会社",
  "approval_state": "owner_verified",
  "content_version": "2026-06-08-v0"
}
```

## V0 Scope

- Aikan / LENRI seed に owner verified guide stop を追加。
- Area polygon API が `guide_stop` と `guide_stop_json` を返す。
- `/map` area sheet が guide stop card を表示。
- `navigator.geolocation.watchPosition` で距離を更新。
- 範囲内だけ `SpeechSynthesisUtterance` で読み上げる。

## Next Evolution

管理者画面で guide stop の申請、承認、公開期間、本文バージョン、QR/NFC fallback URL を扱えるようにする。
