# Kubiaka ecology and product scope — revision 2

Date: 2026-07-30
Status: authoritative research baseline before the next UI revision

## Decision

The experience must not be designed as a cherry-tree-only campaign.

The primary domestic management scope is **Rosaceae trees, especially Prunus street trees and fruit trees**, including cherry, Japanese apricot/ume, peach, Japanese plum/sumomo, and apricot. The service must cover both public trees and orchards without requiring the contributor to identify the tree species.

## Authoritative findings

### Host and impact scope

- MAFF describes *Aromia bungii* as an important pest of peach, apricot, and other Prunus fruit trees. Early Japanese detections were mainly on park and street cherry trees, while recent damage includes ume and peach orchards.
- NARO's 2026 integrated manual is explicitly designed for Rosaceae fruit trees such as peach, ume, and sumomo, as well as other managed trees.
- Official national and prefectural guidance commonly lists cherry, peach, ume, sumomo, and apricot as principal trees of concern.
- Damage is not limited to scenery. Larvae weaken and may kill fruit trees and public trees; advanced damage can also increase branch-fall and tree-failure risk.

### Life cycle and observable evidence

- Larvae live and feed inside the tree for roughly 1–3 years before emerging as adults.
- Adults are mainly observed from late May through August, with regional peaks around late June to late July.
- Frass — a mixture of larval feces and wood debris — can be discharged for a much longer period, broadly from spring into autumn depending on region.
- Useful field evidence is therefore not limited to an adult insect. It includes:
  - adult beetle
  - fresh or suspicious frass
  - exit/emergence holes and bark damage
  - whole-tree condition and decline

### Current urgency

- MAFF's 2026-07-28 update reports confirmed occurrence in 20 prefectures.
- Yamanashi confirmed the species not only on park cherry trees but also in peach and sumomo orchards in July 2026, demonstrating that an orchard-safe design is essential.

### Legal and handling boundary

- The species has been designated a specified invasive alien species under Japan's Invasive Alien Species Act since January 2018.
- Keeping or transporting a live individual is generally prohibited. Public guidance tells finders not to carry it alive and to follow local authority instructions.
- ZUKAN must not automatically send externally, but it must not hide urgent official guidance when an adult or convincing damage sign is selected.

## Product changes required

### 1. Entry concept

Replace the cherry-only promise:

> 近くのサクラを撮ってみよう。

with a host-aware concept such as:

> サクラや果樹の異変を、地域の記録に。

The page may use cherry as one familiar example, but not as the product boundary.

### 2. Do not require tree identification

Tree type is optional and contributor-facing choices should be:

- サクラ
- モモ
- スモモ
- ウメ
- アンズ
- わからない
- その他

`わからない` must be a first-class valid state.

### 3. Start from what was noticed

The first evidence choice should be observational rather than taxonomic:

- 木全体・幹や枝
- 木くずのようなもの（フラス候補）
- 赤い首の黒いカミキリムシ（成虫候補）
- 穴・樹皮の傷み
- よくわからない

No option may claim confirmation.

### 4. Context without burden

Capture an optional context:

- 公園・街路樹など
- 果樹園
- 庭木・私有地
- わからない

This context controls privacy, copy, and later operator workflow. It must not trigger automatic reporting.

### 5. Seasonal guidance

Use a versioned seasonal module:

- adult-focused guidance during approximately May–August
- frass and tree-condition guidance across spring–autumn
- no absence claim when no sign is visible

The exact local period must remain configurable rather than hard-coded as a universal biological rule.

### 6. One-photo-first, not one-photo-only

- One photo must be enough to start a record.
- Additional photos must not be required before save.
- Optional existing photos may be added when already available.
- The UI must not imply that one general tree photo is sufficient for species confirmation or damage diagnosis.

### 7. Conditional safety guidance

When an adult candidate or strong damage sign is selected, show a concise notice:

- do not transport a live specimen
- follow local authority guidance
- ZUKAN does not automatically report or send the record

This notice should appear after the user's observation choice, not as a heavy warning before participation.

## Revised product structure

1. public landing: host-tree scope and low-burden explanation
2. observation choice: tree / frass / adult / hole-damage / unknown
3. optional host and place context
4. existing composer reuse through a dedicated Kubiaka entry context
5. private receipt and honest evidence state
6. conditional official-guidance handoff, never automatic external send
7. operator and orchard workflows remain separate from the casual public route

## Sources

- Ministry of Agriculture, Forestry and Fisheries, `クビアカツヤカミキリに関する情報`, updated 2026-07-28: https://www.maff.go.jp/j/syouan/syokubo/keneki/k_kokunai/kubiaka/kubiaka.html
- NARO, `日本の果樹と樹木を守る外来カミキリムシ総合対策マニュアル`, published 2026-03-31: https://www.naro.go.jp/publicity_report/publication/pamphlet/tech-pamph/175662.html
- Ministry of the Environment, Kubiaka resource collection: https://www.env.go.jp/nature/intro/4document/species/kubiaka.html
- Forestry and Forest Products Research Institute, `クビアカツヤカミキリの防除法`: https://www.ffpri.go.jp/pubs/chukiseika/5th-chuukiseika12.html
- National Institute for Environmental Studies, Invasive Species Database: https://www.nies.go.jp/biodiversity/invasive/DB/detail/60560.html
- Yamanashi Prefecture, `特定外来生物クビアカツヤカミキリの発生に注意してください`, updated 2026-07-15: https://www.pref.yamanashi.jp/nougyo-gjt/kubiakatsuyakamikiri.html
- Kinki Regional Agricultural Administration Office, control information: https://www.maff.go.jp/kinki/syouhi/mn/content/kubiaka.html
- Tochigi Prefecture, biology and control guidance: https://www.pref.tochigi.lg.jp/d04/seibututayousei/kubiakatuyakamikiri.html
