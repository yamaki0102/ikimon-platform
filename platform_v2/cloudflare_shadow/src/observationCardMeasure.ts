import type { GeminiObservationImage } from "./geminiObservationBatch";

type Json = Record<string, unknown>;

export const MEASURE_VERSION = "card-measure/v1";
export const LOOKALIKE_STORE_PREFIX = "lookalike-v1-";

export const KEY_GROUPS: Record<string, string> = { bird: "bird", insect: "insect (butterfly, moth, dragonfly, beetle, bee, grasshopper, etc.)", spider: "spider", herp: "amphibian or reptile (frog, newt, lizard, snake, turtle)", fish: "fish", mammal: "mammal", plant: "vascular plant (flower, tree, grass, fern)", moss: "moss or liverwort", lichen: "lichen", fungus: "fungus (mushroom, bracket)", invert: "other invertebrate (snail, slug, crab, worm, etc.)", unclear: "cannot tell from these photos" };
export const KEY_KINDS: Record<string, string> = { single: "one living organism (or one kind of organism) is clearly the main subject", multi: "several different kinds of organisms are equally prominent", scene: "a landscape, habitat or human-made scene with no single organism as the subject", none: "no living organism is visible" };
export const KEY_FAMILIES: Record<string, string> = {
  bird: "Corvidae: crows, jays, magpies|Passeridae: sparrows|Zosteropidae: white-eyes|Paridae: tits|Aegithalidae: long-tailed tits|Pycnonotidae: bulbuls|Sturnidae: starlings|Columbidae: pigeons, doves|Hirundinidae: swallows, martins|Motacillidae: wagtails, pipits|Muscicapidae: Old World flycatchers, redstarts, rock thrushes|Turdidae: thrushes|Laniidae: shrikes|Fringillidae: finches, grosbeaks|Emberizidae: buntings|Cettiidae: bush warblers|Phylloscopidae: leaf warblers|Acrocephalidae: reed warblers|Alcedinidae: kingfishers|Picidae: woodpeckers|Ardeidae: herons, egrets|Anatidae: ducks, geese, swans|Rallidae: rails, coots, moorhens|Phalacrocoracidae: cormorants|Accipitridae: hawks, kites, eagles|Falconidae: falcons, kestrels|Laridae: gulls, terns|Phasianidae: pheasants, quails|Charadriidae: plovers|Scolopacidae: sandpipers, snipes|Strigidae: owls|Cuculidae: cuckoos|Podicipedidae: grebes|Apodidae: swifts|Alaudidae: larks",
  insect: "Papilionidae: swallowtail butterflies|Pieridae: whites and yellows|Lycaenidae: blues, coppers, hairstreaks|Nymphalidae: brush-footed butterflies|Hesperiidae: skippers|Sphingidae: hawk moths|Saturniidae: silk moths|Geometridae: geometer moths|Noctuidae or Erebidae: owlet and tiger moths|Libellulidae: skimmer dragonflies, darters|Aeshnidae: darner dragonflies|Gomphidae: clubtail dragonflies|Cordulegastridae: golden-ringed dragonflies|Calopterygidae: broad-winged damselflies|Coenagrionidae: narrow-winged damselflies|Coccinellidae: ladybird beetles|Chrysomelidae: leaf beetles|Scarabaeidae: scarab beetles, chafers|Lucanidae: stag beetles|Cerambycidae: longhorn beetles|Carabidae: ground beetles|Curculionidae: weevils|Cicadidae: cicadas|Pentatomidae: stink bugs|Aphididae: aphids|Acrididae: grasshoppers, locusts|Tettigoniidae: katydids, bush crickets|Gryllidae: crickets|Mantidae: mantises|Apidae: bees, bumblebees, carpenter bees|Vespidae: hornets, paper wasps|Formicidae: ants|Syrphidae: hoverflies|Muscidae or Calliphoridae: house flies, blow flies|Tipulidae: crane flies|Blattidae: cockroaches",
  spider: "Araneidae: orb weavers incl. Joro spider (Trichonephila) and Argiope|Tetragnathidae: long-jawed orb weavers, silver orb spiders (Leucauge)|Salticidae: jumping spiders|Thomisidae: crab spiders|Sparassidae: huntsman spiders|Lycosidae: wolf spiders|Theridiidae: cobweb spiders|Pisauridae: nursery web spiders|Agelenidae: funnel weavers|Uloboridae: cribellate orb weavers|Oxyopidae: lynx spiders",
  herp: "Hylidae: tree frogs (Japanese tree frog)|Rhacophoridae: shrub frogs (Schlegel's green tree frog, forest green tree frog)|Ranidae: true frogs (pond frogs, brown frogs, bullfrog)|Bufonidae: toads|Dicroglossidae: fork-tongued frogs|Salamandridae: newts|Hynobiidae: Asian salamanders|Cryptobranchidae: giant salamanders|Scincidae: skinks|Lacertidae: grass lizards|Gekkonidae: geckos|Colubridae: colubrid snakes|Viperidae: pit vipers (mamushi)|Geoemydidae: pond turtles|Emydidae: sliders|Trionychidae: softshell turtles",
  fish: "Cyprinidae: carps, koi, goldfish, crucian carps|Xenocyprididae: pale chub, Japanese dace|Adrianichthyidae: medaka, ricefish|Cobitidae: loaches|Gobiidae: gobies|Salmonidae: salmon, trout, char|Centrarchidae: bluegill, black bass|Plecoglossidae: ayu|Siluridae: catfish|Mugilidae: mullets|Sparidae: sea breams",
  mammal: "Canidae: raccoon dog, fox, dog|Procyonidae: raccoon|Viverridae: masked palm civet|Mustelidae: weasels, martens, badgers|Felidae: cats|Cervidae: deer|Suidae: wild boar|Cercopithecidae: macaques|Sciuridae: squirrels, flying squirrels|Muridae: rats, mice|Leporidae: hares, rabbits|Vespertilionidae: bats|Ursidae: bears|Talpidae: moles|Bovidae: serow",
  plant: "Rosaceae: cherries, plums, roses|Fabaceae: legumes, clovers, kudzu|Asteraceae: daisies, dandelions, cosmos|Poaceae: grasses, bamboo, rice|Cyperaceae: sedges|Commelinaceae: dayflowers, spiderworts|Ericaceae: azaleas, heaths, alpine dwarf shrubs|Fagaceae: oaks, beech, chestnut|Pinaceae: pines, firs|Cupressaceae: Japanese cedar, cypress|Lauraceae: camphor tree|Ulmaceae or Cannabaceae: zelkova, hackberry|Sapindaceae: maples|Theaceae: camellias|Hydrangeaceae: hydrangeas|Brassicaceae: mustards, cabbage|Lamiaceae: mints|Apiaceae: carrot family|Ranunculaceae: buttercups, anemones|Liliaceae: lilies|Amaryllidaceae: spider lily, onions|Orchidaceae: orchids|Iridaceae: irises|Convolvulaceae: morning glories|Polygonaceae: knotweeds, docks|Caryophyllaceae: chickweeds, pinks|Plantaginaceae: plantains, speedwells|Violaceae: violets|Rubiaceae: madder family|Saururaceae: dokudami|Vitaceae: grapes, bushkiller|Betulaceae: alders, birches|Salicaceae: willows|Moraceae: figs, mulberries|Ginkgoaceae: ginkgo|Nymphaeaceae: water lilies|Nelumbonaceae: lotus|Oleaceae: olives, osmanthus|Magnoliaceae: magnolias|Cercidiphyllaceae: katsura|Oxalidaceae: wood sorrels|Malvaceae: mallows|Solanaceae: nightshades|Araceae: arums|Typhaceae: cattails|Equisetaceae: horsetails|Dennstaedtiaceae: bracken|Dryopteridaceae: wood ferns|Rutaceae: citrus|Viburnaceae: viburnums|Caprifoliaceae: honeysuckles|Asparagaceae: hostas, lily-of-the-valley|Gentianaceae: gentians|Campanulaceae: bellflowers|Euphorbiaceae: spurges|Primulaceae: primroses, ardisia",
  moss: "Polytrichaceae: haircap mosses|Hypnaceae: plait mosses|Bryaceae: thread mosses, silver moss|Marchantiaceae: thalloid liverworts|Sphagnaceae: peat mosses|Mniaceae: thyme mosses|Dicranaceae: fork mosses|Thuidiaceae: fern mosses|Leucobryaceae: cushion mosses",
  fungus: "Amanitaceae: amanitas (fly agaric)|Russulaceae: brittlegills, milkcaps|Boletaceae: boletes|Polyporaceae: bracket fungi, polypores|Agaricaceae: field mushrooms, puffballs|Physalacriaceae: honey fungus, enoki|Omphalotaceae: shiitake|Pleurotaceae: oyster mushrooms|Strophariaceae: scalycaps|Hygrophoraceae: waxcaps|Tricholomataceae: tricholomas|Ganodermataceae: reishi|Auriculariaceae: jelly ear|Morchellaceae: morels|Phallaceae: stinkhorns|Mycenaceae: bonnets",
  invert: "Camaenidae: land snails|Philomycidae or Limacidae: slugs|Armadillidiidae: pill bugs|Scolopendridae: centipedes|Diplopoda: millipedes|Lumbricidae or Megascolecidae: earthworms|Cambaridae: crayfish|Potamidae or Sesarmidae: freshwater and shore crabs|Palaemonidae or Atyidae: shrimps|Mytilidae or Ostreidae: mussels, oysters|Asteroidea: sea stars|Echinoidea: sea urchins",
};
export const FAMILY_JA: Record<string, string> = {"Corvidae":"カラス科","Passeridae":"スズメ科","Zosteropidae":"メジロ科","Paridae":"シジュウカラ科","Aegithalidae":"エナガ科","Pycnonotidae":"ヒヨドリ科","Sturnidae":"ムクドリ科","Columbidae":"ハト科","Hirundinidae":"ツバメ科","Motacillidae":"セキレイ科","Muscicapidae":"ヒタキ科","Turdidae":"ツグミ科","Laniidae":"モズ科","Fringillidae":"アトリ科","Emberizidae":"ホオジロ科","Cettiidae":"ウグイス科","Phylloscopidae":"ムシクイ科","Acrocephalidae":"ヨシキリ科","Alcedinidae":"カワセミ科","Picidae":"キツツキ科","Ardeidae":"サギ科","Anatidae":"カモ科","Rallidae":"クイナ科","Phalacrocoracidae":"ウ科","Accipitridae":"タカ科","Falconidae":"ハヤブサ科","Laridae":"カモメ科","Phasianidae":"キジ科","Charadriidae":"チドリ科","Scolopacidae":"シギ科","Strigidae":"フクロウ科","Cuculidae":"カッコウ科","Podicipedidae":"カイツブリ科","Apodidae":"アマツバメ科","Alaudidae":"ヒバリ科","Papilionidae":"アゲハチョウ科","Pieridae":"シロチョウ科","Lycaenidae":"シジミチョウ科","Nymphalidae":"タテハチョウ科","Hesperiidae":"セセリチョウ科","Sphingidae":"スズメガ科","Saturniidae":"ヤママユガ科","Geometridae":"シャクガ科","Noctuidae or Erebidae":"ヤガ科・トモエガ科","Libellulidae":"トンボ科","Aeshnidae":"ヤンマ科","Gomphidae":"サナエトンボ科","Cordulegastridae":"オニヤンマ科","Calopterygidae":"カワトンボ科","Coenagrionidae":"イトトンボ科","Coccinellidae":"テントウムシ科","Chrysomelidae":"ハムシ科","Scarabaeidae":"コガネムシ科","Lucanidae":"クワガタムシ科","Cerambycidae":"カミキリムシ科","Carabidae":"オサムシ科","Curculionidae":"ゾウムシ科","Cicadidae":"セミ科","Pentatomidae":"カメムシ科","Aphididae":"アブラムシ科","Acrididae":"バッタ科","Tettigoniidae":"キリギリス科","Gryllidae":"コオロギ科","Mantidae":"カマキリ科","Apidae":"ミツバチ科","Vespidae":"スズメバチ科","Formicidae":"アリ科","Syrphidae":"ハナアブ科","Muscidae or Calliphoridae":"イエバエ科・クロバエ科","Tipulidae":"ガガンボ科","Blattidae":"ゴキブリ科","Araneidae":"コガネグモ科","Tetragnathidae":"アシナガグモ科","Salticidae":"ハエトリグモ科","Thomisidae":"カニグモ科","Sparassidae":"アシダカグモ科","Lycosidae":"コモリグモ科","Theridiidae":"ヒメグモ科","Pisauridae":"キシダグモ科","Agelenidae":"タナグモ科","Uloboridae":"ウズグモ科","Oxyopidae":"ササグモ科","Hylidae":"アマガエル科","Rhacophoridae":"アオガエル科","Ranidae":"アカガエル科","Bufonidae":"ヒキガエル科","Dicroglossidae":"ヌマガエル科","Salamandridae":"イモリ科","Hynobiidae":"サンショウウオ科","Cryptobranchidae":"オオサンショウウオ科","Scincidae":"トカゲ科","Lacertidae":"カナヘビ科","Gekkonidae":"ヤモリ科","Colubridae":"ナミヘビ科","Viperidae":"クサリヘビ科","Geoemydidae":"イシガメ科","Emydidae":"ヌマガメ科","Trionychidae":"スッポン科","Cyprinidae":"コイ科","Xenocyprididae":"クセノキプリス科","Adrianichthyidae":"メダカ科","Cobitidae":"ドジョウ科","Gobiidae":"ハゼ科","Salmonidae":"サケ科","Centrarchidae":"サンフィッシュ科","Plecoglossidae":"アユ科","Siluridae":"ナマズ科","Mugilidae":"ボラ科","Sparidae":"タイ科","Canidae":"イヌ科","Procyonidae":"アライグマ科","Viverridae":"ジャコウネコ科","Mustelidae":"イタチ科","Felidae":"ネコ科","Cervidae":"シカ科","Suidae":"イノシシ科","Cercopithecidae":"オナガザル科","Sciuridae":"リス科","Muridae":"ネズミ科","Leporidae":"ウサギ科","Vespertilionidae":"ヒナコウモリ科","Ursidae":"クマ科","Talpidae":"モグラ科","Bovidae":"ウシ科","Rosaceae":"バラ科","Fabaceae":"マメ科","Asteraceae":"キク科","Poaceae":"イネ科","Cyperaceae":"カヤツリグサ科","Commelinaceae":"ツユクサ科","Ericaceae":"ツツジ科","Fagaceae":"ブナ科","Pinaceae":"マツ科","Cupressaceae":"ヒノキ科","Lauraceae":"クスノキ科","Ulmaceae or Cannabaceae":"ニレ科・アサ科","Sapindaceae":"ムクロジ科","Theaceae":"ツバキ科","Hydrangeaceae":"アジサイ科","Brassicaceae":"アブラナ科","Lamiaceae":"シソ科","Apiaceae":"セリ科","Ranunculaceae":"キンポウゲ科","Liliaceae":"ユリ科","Amaryllidaceae":"ヒガンバナ科","Orchidaceae":"ラン科","Iridaceae":"アヤメ科","Convolvulaceae":"ヒルガオ科","Polygonaceae":"タデ科","Caryophyllaceae":"ナデシコ科","Plantaginaceae":"オオバコ科","Violaceae":"スミレ科","Rubiaceae":"アカネ科","Saururaceae":"ドクダミ科","Vitaceae":"ブドウ科","Betulaceae":"カバノキ科","Salicaceae":"ヤナギ科","Moraceae":"クワ科","Ginkgoaceae":"イチョウ科","Nymphaeaceae":"スイレン科","Nelumbonaceae":"ハス科","Oleaceae":"モクセイ科","Magnoliaceae":"モクレン科","Cercidiphyllaceae":"カツラ科","Oxalidaceae":"カタバミ科","Malvaceae":"アオイ科","Solanaceae":"ナス科","Araceae":"サトイモ科","Typhaceae":"ガマ科","Equisetaceae":"トクサ科","Dennstaedtiaceae":"コバノイシカグマ科","Dryopteridaceae":"オシダ科","Rutaceae":"ミカン科","Viburnaceae":"ガマズミ科","Caprifoliaceae":"スイカズラ科","Asparagaceae":"キジカクシ科","Gentianaceae":"リンドウ科","Campanulaceae":"キキョウ科","Euphorbiaceae":"トウダイグサ科","Primulaceae":"サクラソウ科","Polytrichaceae":"スギゴケ科","Hypnaceae":"ハイゴケ科","Bryaceae":"ハリガネゴケ科","Marchantiaceae":"ゼニゴケ科","Sphagnaceae":"ミズゴケ科","Mniaceae":"チョウチンゴケ科","Dicranaceae":"シッポゴケ科","Thuidiaceae":"シノブゴケ科","Leucobryaceae":"シラガゴケ科","Amanitaceae":"テングタケ科","Russulaceae":"ベニタケ科","Boletaceae":"イグチ科","Polyporaceae":"タコウキン科","Agaricaceae":"ハラタケ科","Physalacriaceae":"タマバリタケ科","Omphalotaceae":"ツキヨタケ科","Pleurotaceae":"ヒラタケ科","Strophariaceae":"モエギタケ科","Hygrophoraceae":"ヌメリガサ科","Tricholomataceae":"キシメジ科","Ganodermataceae":"マンネンタケ科","Auriculariaceae":"キクラゲ科","Morchellaceae":"アミガサタケ科","Phallaceae":"スッポンタケ科","Mycenaceae":"クヌギタケ科","Camaenidae":"ナンバンマイマイ科","Philomycidae or Limacidae":"ヤマナメクジ科・ナメクジ科","Armadillidiidae":"オカダンゴムシ科","Scolopendridae":"オオムカデ科","Diplopoda":"ヤスデ綱","Lumbricidae or Megascolecidae":"ツリミミズ科・フトミミズ科","Cambaridae":"アメリカザリガニ科","Potamidae or Sesarmidae":"サワガニ科・ベンケイガニ科","Palaemonidae or Atyidae":"テナガエビ科・ヌマエビ科","Mytilidae or Ostreidae":"イガイ科・イタボガキ科","Asteroidea":"ヒトデ綱","Echinoidea":"ウニ綱"};
export const QUALITY_LEVELS = ["useless: subject unrecognizable", "poor: only the broad group is recognizable", "fair: some diagnostic features visible", "good: most diagnostic features visible", "excellent: all diagnostic features clearly visible"];
export const QUALITY_JA = ["対象が判別できない", "大まかな仲間だけ分かる", "決め手の一部が写っている", "決め手の多くが写っている", "決め手がはっきり写っている"];

export type DecisionQuestion = { type: "noul"; instructions: string } | { type: "choice" | "score"; instructions: string; criteria: Record<string, string> | string[] };
export type DecisionAnswer = { noul?: number; choice?: string; confidence?: number; score?: number; probabilities?: Record<string, number> };
export type DecideMany = (images: GeminiObservationImage[], questions: Record<string, DecisionQuestion>) => Promise<Record<string, DecisionAnswer>>;

const familyCriteria = (group: string): Record<string, string> => Object.fromEntries((KEY_FAMILIES[group] ?? "").split("|").filter(Boolean).map((x, i) => [`f${i}`, x] as [string, string]).concat([["zz_other", "a family not in this list"], ["zz_cant", "cannot tell from these photos"]]));

export function sceneQuestions(): Record<string, DecisionQuestion> {
  const q: Record<string, DecisionQuestion> = {
    kind: { type: "choice", instructions: "What do these outdoor photos from Japan mainly show?", criteria: KEY_KINDS },
    group: { type: "choice", instructions: "Which group does the main living organism belong to? Ignore people and pets on a leash.", criteria: KEY_GROUPS },
    quality: { type: "score", instructions: "How useful are these photos for identifying the main organism or reading the habitat?", criteria: QUALITY_LEVELS },
  };
  for (const g of Object.keys(KEY_FAMILIES)) q[`fam_${g}`] = { type: "choice", instructions: `If the main organism is a ${KEY_GROUPS[g]}, which family is it?`, criteria: familyCriteria(g) };
  return q;
}

export type SceneMeasure = { kind: string; group: string; family: string | null; familyP: number; accepted: boolean; quality: number | null; qualityLabel: string | null };

export function readScene(a: Record<string, DecisionAnswer>): SceneMeasure {
  const kind = String(a.kind?.choice ?? "");
  const group = String(a.group?.choice ?? "");
  const fq = a[`fam_${group}`];
  const famKey = String(fq?.choice ?? "");
  const family = fq && !famKey.startsWith("zz_") ? (familyCriteria(group)[famKey] ?? "").split(":")[0] || null : null;
  const escape = Number(fq?.probabilities?.zz_other ?? 0) + Number(fq?.probabilities?.zz_cant ?? 0);
  const familyP = Number(fq?.confidence ?? 0);
  const accepted = kind === "single" && Number(a.kind?.confidence ?? 0) >= 0.7 && Number(a.group?.confidence ?? 0) >= 0.8 && family !== null && familyP >= 0.6 && escape < 0.3;
  const raw = Number(a.quality?.score);
  const quality = Number.isFinite(raw) ? Math.max(0, Math.min(4, raw)) : null;
  return { kind, group, family, familyP, accepted, quality, qualityLabel: quality === null ? null : QUALITY_JA[Math.round(quality)] ?? null };
}

export const LOOKALIKE_PROMPT = (ja: string, sci: string, rank: string): string => `A nature photo taken in Japan was provisionally identified as ${ja} (${sci || "?"}, rank ${rank}). Build a lookalike card that helps a beginner confirm the identification.
Return JSON only:
{"group":{"ja":"","sci":"","rank":"genus|family|order"},"candidates":[{"ja":"","sci":"","how_ja":"","features":[{"part_ja":"","ja":"","q":""}]}]}
Rules:
- candidates: 3 or 4 taxa commonly seen in Japan that are most often confused with this one in photos. Put the provisional taxon first if it is a species; if the provisional rank is above species, list the commonest species of that group in Japan. Lookalikes may come from other genera or families.
- group: the smallest taxon containing all candidates.
- how_ja: one short Japanese sentence on how to tell it from the other candidates.
- features: exactly 2 visible traits per candidate that separate it from the others. ja = short Japanese description (<= 30 chars). q = an English yes/no question answerable from a photo, naming the body part, e.g. "Is the base of the forewing solid black?"
- Use only well-established field marks. If unsure, give fewer candidates.`;

export type LookalikeCard = { group: { ja: string; sci: string; rank: string }; candidates: Array<{ ja: string; sci: string; how: string; features: Array<{ part: string; ja: string; q: string }> }> };

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const objs = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Json[]) : []);

export function normalizeLookalike(raw: unknown): LookalikeCard | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Json;
  const g = (r.group && typeof r.group === "object" ? r.group : {}) as Json;
  const candidates = objs(r.candidates).map((c) => ({
    ja: s(c.ja, 60), sci: s(c.sci, 120), how: s(c.how_ja ?? c.how, 120),
    features: objs(c.features).map((f) => ({ part: s(f.part_ja ?? f.part, 30), ja: s(f.ja, 60), q: s(f.q, 200) })).filter((f) => f.ja && f.q).slice(0, 2),
  })).filter((c) => c.ja && c.features.length > 0).slice(0, 4);
  if (candidates.length < 2) return null;
  return { group: { ja: s(g.ja, 60), sci: s(g.sci, 120), rank: s(g.rank, 20) }, candidates };
}

export const presenceQuestion = (sub: Json): string => `Do these photos show ${s(sub.name, 120)}${s(sub.scientific_name, 180) ? ` (${s(sub.scientific_name, 180)})` : ""}? Answer yes if the named taxon is visible, at the rank given.`;

export function subjectQuestions(subjects: Json[], card: LookalikeCard | null): Record<string, DecisionQuestion> {
  const q: Record<string, DecisionQuestion> = {};
  subjects.slice(0, 8).forEach((sub, i) => { q[`s${i}`] = { type: "noul", instructions: presenceQuestion(sub) }; });
  if (card) {
    q.pick = { type: "choice", instructions: "Which taxon is the main living organism in these photos (taken outdoors in Japan)?", criteria: { ...Object.fromEntries(card.candidates.map((c, i) => [`c${i}`, `${c.sci || c.ja}: ${c.features.map((f) => f.q.replace(/\?$/, "")).join("; ")}`])), zz_other: "a different organism not in this list" } };
    card.candidates.forEach((c, i) => c.features.forEach((f, k) => { q[`f${i}_${k}`] = { type: "noul", instructions: f.q }; }));
  }
  return q;
}

export const measuredBand = (p: number): "high" | "medium" | "low" => (p >= 0.8 ? "high" : p >= 0.5 ? "medium" : "low");
export const featureState = (p: number | undefined): "seen" | "not_seen" | "unclear" => (p === undefined || !Number.isFinite(p) ? "unclear" : p >= 0.7 ? "seen" : p <= 0.25 ? "not_seen" : "unclear");

export type LookalikeMeasure = { group: LookalikeCard["group"]; other: number; candidates: Array<{ ja: string; sci: string; how: string; p: number; features: Array<{ part: string; ja: string; state: "seen" | "not_seen" | "unclear" }> }> };

export function readLookalike(card: LookalikeCard, a: Record<string, DecisionAnswer>): LookalikeMeasure {
  const probs = a.pick?.probabilities ?? {};
  const candidates = card.candidates.map((c, i) => ({
    ja: c.ja, sci: c.sci, how: c.how, p: Math.round(Number(probs[`c${i}`] ?? 0) * 100) / 100,
    features: c.features.map((f, k) => ({ part: f.part, ja: f.ja, state: featureState(a[`f${i}_${k}`]?.noul) })),
  })).sort((x, y) => y.p - x.p);
  return { group: card.group, other: Math.round(Number(probs.zz_other ?? 0) * 100) / 100, candidates };
}

export async function callDecisionQuestions(apiKey: string, model: string, images: GeminiObservationImage[], questions: Record<string, DecisionQuestion>, fetcher: typeof fetch = fetch): Promise<Record<string, DecisionAnswer>> {
  const body = JSON.stringify({ model, input: images.map((image) => ({ type: "image", data: image.base64Data, mime_type: image.mimeType, resolution: "medium" })), questions });
  let lastError = "card_measure_failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/decisions", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body, signal: AbortSignal.timeout(30_000) });
      if (response.ok) {
        const answers = ((await response.json()) as { answers?: Record<string, DecisionAnswer> }).answers;
        if (!answers || typeof answers !== "object") throw new Error("card_measure_answers_missing");
        return answers;
      }
      lastError = `card_measure_api_failed:${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = (error instanceof Error ? error.message : String(error)).slice(0, 160);
      if (lastError === "card_measure_answers_missing") break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(lastError);
}
