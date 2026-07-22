# PR-E: observation-first shadow read

## 契約

- user-visible readerは切り替えず、legacy summaryとobservation-first read modelを同じrecord単位で比較する。
- sampleは100件以上とし、0 / 1 / N observation、media association、identification、privacy、rightsを含む。
- public modelへexact latitude / longitude、cell ID、mesh、geohash、coordinate-derived IDを含めない。
- AI suggestionはprovisionalとして独立表示し、community identification件数やaccepted identificationへ算入しない。
- accepted identificationは、owner / community / curatorの明示的なaccepted claimと一致する場合だけ返す。
- private recordはowner以外へ返さず、proposal policyを常に無効にする。

## promotion gate

`npm run compare:record-observation-shadow -- --input <sanitized-json> --report <report-json>` が次を満たすこと。

- `compared >= 100`
- unexplained P0 = 0
- unexplained P1 = 0
- privacy findings = 0
- raw locationをinput/reportへ含めない

差分を説明・修正するまでread cutover flagはOFFのままにする。
