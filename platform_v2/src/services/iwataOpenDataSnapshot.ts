export type IwataDatasetKey = "tourism" | "park" | "community" | "cultural";

export type IwataOpenDataItem = {
  id: string;
  dataset: IwataDatasetKey;
  sourceRecordId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  summary: string | null;
  phone: string | null;
  detailUrl: string | null;
  sourceUrl: string;
  sourceUpdatedAt: string;
  attributes: Record<string, string | number | boolean | null>;
};

export type IwataDatasetMetadata = {
  key: IwataDatasetKey;
  label: string;
  description: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
};

export const IWATA_OPEN_DATA_RETRIEVED_AT = "2026-07-28";
export const IWATA_OPEN_DATA_CITY_PAGE = "https://www.city.iwata.shizuoka.jp/shiseijouhou/1006207/1002775.html";
export const IWATA_OPEN_DATA_LICENSE_LABEL = "磐田市オープンデータ利用規約（CC BY 2.1 JP）／LinkData metadata（CC BY 3.0）";

export const IWATA_DATASETS: readonly IwataDatasetMetadata[] = [
  {
    key: "tourism",
    label: "観光施設",
    description: "自治体標準オープンデータセットとして公開される観光・文化・自然の施設情報。",
    sourceUrl: "https://linkdata.org/view/rdf1s10214i",
    sourceUpdatedAt: "2024-03-26",
  },
  {
    key: "park",
    label: "都市公園",
    description: "所在地、面積、設備、緯度・経度を含む都市公園情報。",
    sourceUrl: "https://linkdata.org/view/rdf1s3748i",
    sourceUpdatedAt: "2022-10-28",
  },
  {
    key: "community",
    label: "交流センター",
    description: "地域活動拠点の名称、所在地、電話番号、緯度・経度。",
    sourceUrl: "https://linkdata.org/view/rdf1s4564i",
    sourceUpdatedAt: "2022-10-28",
  },
  {
    key: "cultural",
    label: "文化財",
    description: "自治体標準オープンデータセットとして公開される指定・登録文化財情報。",
    sourceUrl: "https://linkdata.org/view/rdf1s10219i",
    sourceUpdatedAt: "2024-03-26",
  },
] as const;

const tourismSource = "https://linkdata.org/view/rdf1s10214i";
const parkSource = "https://linkdata.org/view/rdf1s3748i";
const communitySource = "https://linkdata.org/view/rdf1s4564i";
const culturalSource = "https://linkdata.org/view/rdf1s10219i";

export const IWATA_OPEN_DATA_ITEMS: readonly IwataOpenDataItem[] = [
  {
    id: "iwata:tourism:1", dataset: "tourism", sourceRecordId: "1", name: "桶ケ谷沼ビジターセンター",
    address: "磐田市岩井315", latitude: 34.74013574, longitude: 137.8876385,
    summary: "桶ケ谷沼の自然とトンボをはじめとする動植物を紹介する観察拠点。", phone: null,
    detailUrl: "https://okegayanuma.com/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:2", dataset: "tourism", sourceRecordId: "2", name: "竜洋海洋公園オートキャンプ場",
    address: "磐田市駒場6866-10", latitude: 34.65237273, longitude: 137.8072469,
    summary: "海と緑に囲まれたオートキャンプ場。", phone: null,
    detailUrl: "https://www.ryu-yo.co.jp/yoyaku/AUTO/index.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:3", dataset: "tourism", sourceRecordId: "3", name: "獅子ヶ鼻公園",
    address: "磐田市大平 ほか", latitude: 34.84815385, longitude: 137.8756176,
    summary: "展望と岩場、トレッキングを楽しめる自然公園。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/sports_midokoro/kankou/1002018.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:4", dataset: "tourism", sourceRecordId: "4", name: "つつじ公園",
    address: "磐田市見付1010-2", latitude: 34.73089793, longitude: 137.8655529,
    summary: "つつじや桜など、季節の花と景観を楽しめる公園。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/sports_midokoro/kankou/1002021.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:5", dataset: "tourism", sourceRecordId: "5", name: "竜洋海洋公園",
    address: "磐田市駒場6866-5", latitude: 34.65123421, longitude: 137.8021185,
    summary: "遠州灘に近い広い公園とスポーツ・レジャー施設。", phone: null,
    detailUrl: "https://www.entetsuassist-dms.com/ryuyo-kaiyopark/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:6", dataset: "tourism", sourceRecordId: "6", name: "竜洋昆虫自然観察公園",
    address: "磐田市大中瀬320-1", latitude: 34.66898108, longitude: 137.8391867,
    summary: "昆虫館と自然環境を一体で観察できる公園。", phone: null,
    detailUrl: "https://ryu-yo.jp/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:7", dataset: "tourism", sourceRecordId: "7", name: "池田の渡し歴史風景館",
    address: "磐田市池田300-3", latitude: 34.73708038, longitude: 137.8132532,
    summary: "天竜川の渡船と地域の歴史を伝える展示施設。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/shisetsu_guide/toshokan_bunka/tenji/1003510.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:8", dataset: "tourism", sourceRecordId: "8", name: "旧赤松家記念館",
    address: "磐田市見付3884-10", latitude: 34.7323087, longitude: 137.8490948,
    summary: "明治期の屋敷跡と煉瓦造りが残る文化施設。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/shisetsu_guide/toshokan_bunka/tenji/1003511.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:9", dataset: "tourism", sourceRecordId: "9", name: "旧見付学校",
    address: "磐田市見付2452-1", latitude: 34.72770599, longitude: 137.8568625,
    summary: "明治8年建築の木造擬洋風小学校校舎と磐田文庫。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/shisetsu_guide/toshokan_bunka/tenji/1003508.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:10", dataset: "tourism", sourceRecordId: "10", name: "埋蔵文化財センター",
    address: "磐田市見付3678-1", latitude: 34.73040416, longitude: 137.8511977,
    summary: "市内の遺跡・遺物の収蔵、調査研究、展示を行う施設。", phone: null,
    detailUrl: "https://www.city.iwata.shizuoka.jp/shisetsu_guide/toshokan_bunka/tenji/1003512.html", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:11", dataset: "tourism", sourceRecordId: "11", name: "医王寺",
    address: "磐田市鎌田2065-1", latitude: 34.71537518, longitude: 137.8847321,
    summary: "鎌田地区にある寺院。", phone: null,
    detailUrl: "https://www.iouji.net/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:12", dataset: "tourism", sourceRecordId: "12", name: "鎌田神明宮",
    address: "磐田市鎌田2262", latitude: 34.71825012, longitude: 137.8884443,
    summary: "鎌田地区に鎮座する神社。", phone: null,
    detailUrl: "https://kamadashinmeigu.com/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:13", dataset: "tourism", sourceRecordId: "13", name: "西光寺",
    address: "磐田市見付3353-1", latitude: 34.72487546, longitude: 137.8520345,
    summary: "見付地区にある寺院。", phone: null,
    detailUrl: "https://www.saikouji.pw/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:14", dataset: "tourism", sourceRecordId: "14", name: "福王寺",
    address: "磐田市城之崎4-2722-1", latitude: 34.72110127, longitude: 137.8630638,
    summary: "城之崎地区にある寺院。", phone: null,
    detailUrl: null, sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:15", dataset: "tourism", sourceRecordId: "15", name: "府八幡宮",
    address: "磐田市中泉112-1", latitude: 34.72003424, longitude: 137.8534936,
    summary: "中泉地区に鎮座する神社。", phone: null,
    detailUrl: "https://www.fu-hachimangu.jp/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:16", dataset: "tourism", sourceRecordId: "16", name: "見付天神 矢奈比賣神社",
    address: "磐田市見付1114-2", latitude: 34.73022781, longitude: 137.8641152,
    summary: "見付地区に鎮座する神社。", phone: null,
    detailUrl: "https://www.mitsuke-tenjin.com/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:17", dataset: "tourism", sourceRecordId: "17", name: "香りの博物館",
    address: "磐田市立野2019-5", latitude: 34.71630017, longitude: 137.819473,
    summary: "香りの文化と資料、体験を扱う博物館。", phone: null,
    detailUrl: "https://www.iwata-kaori.jp/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:18", dataset: "tourism", sourceRecordId: "18", name: "河合楽器製作所竜洋工場",
    address: "磐田市飛平松252", latitude: 34.66199221, longitude: 137.8290586,
    summary: "ピアノづくりの職人技と製造技術を見学できる工場。", phone: null,
    detailUrl: "https://www.kawai.jp/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },
  {
    id: "iwata:tourism:19", dataset: "tourism", sourceRecordId: "19", name: "コーデュロイハウス",
    address: "磐田市福田中島226-4", latitude: 34.6801965, longitude: 137.8762178,
    summary: "別珍・コーデュロイの生地や製品、手織り体験を紹介する拠点。", phone: null,
    detailUrl: "https://cd-house.com/", sourceUrl: tourismSource, sourceUpdatedAt: "2024-03-26", attributes: {},
  },

  { id: "iwata:park:1", dataset: "park", sourceRecordId: "1", name: "只来下公園", address: "磐田市見付（加茂川通り）5981", latitude: 34.722255, longitude: 137.853661, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 458, sandbox: true, playground: true } },
  { id: "iwata:park:2", dataset: "park", sourceRecordId: "2", name: "西貝塚公園", address: "磐田市西貝塚3775-3", latitude: 34.731864, longitude: 137.879059, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 796.21, playground: true } },
  { id: "iwata:park:3", dataset: "park", sourceRecordId: "3", name: "丸山公園", address: "磐田市城之崎一丁目9", latitude: 34.717674, longitude: 137.867458, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 3865, toilet: true, accessibleToilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:4", dataset: "park", sourceRecordId: "4", name: "旭ヶ丘公園", address: "磐田市国府台56", latitude: 34.721952, longitude: 137.848924, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 5193, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:5", dataset: "park", sourceRecordId: "5", name: "国府台西公園", address: "磐田市国府台114", latitude: 34.717913, longitude: 137.843056, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 2209, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:6", dataset: "park", sourceRecordId: "6", name: "泉公園", address: "磐田市国府台83", latitude: 34.72129, longitude: 137.844772, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 1538, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:7", dataset: "park", sourceRecordId: "7", name: "富士見公園", address: "磐田市富士見町1-20", latitude: 34.729592, longitude: 137.868022, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 3202, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:8", dataset: "park", sourceRecordId: "8", name: "経塚公園", address: "磐田市富士見町1-2", latitude: 34.731955, longitude: 137.870404, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 3155, toilet: true, accessibleToilet: true, playground: true } },
  { id: "iwata:park:9", dataset: "park", sourceRecordId: "9", name: "上野公園", address: "磐田市国府台19", latitude: 34.716749, longitude: 137.847508, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 6986, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:10", dataset: "park", sourceRecordId: "10", name: "久保公園", address: "磐田市久保町1272", latitude: 34.714356, longitude: 137.84767, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 555.58, playground: true } },
  { id: "iwata:park:11", dataset: "park", sourceRecordId: "11", name: "城之崎公園", address: "磐田市城之崎四丁目6", latitude: 34.718714, longitude: 137.863569, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 3438, toilet: true, sandbox: true, playground: true } },
  { id: "iwata:park:12", dataset: "park", sourceRecordId: "12", name: "南御厨東公園", address: "磐田市東新町三丁目161-285", latitude: 34.703521, longitude: 137.889597, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 2852, sandbox: true, playground: true } },
  { id: "iwata:park:13", dataset: "park", sourceRecordId: "13", name: "南御厨西公園", address: "磐田市東新町二丁目161-2", latitude: 34.702568, longitude: 137.886701, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 2905, sandbox: true, playground: true } },
  { id: "iwata:park:14", dataset: "park", sourceRecordId: "14", name: "一番町公園", address: "磐田市見付（一番町）2912-1", latitude: 34.724618, longitude: 137.854756, summary: null, phone: null, detailUrl: null, sourceUrl: parkSource, sourceUpdatedAt: "2022-10-28", attributes: { areaSquareMeters: 2550, toilet: true, sandbox: true, playground: true } },

  { id: "iwata:community:1", dataset: "community", sourceRecordId: "1", name: "岩田交流センター", address: "磐田市匂坂上615-1", latitude: 34.772918, longitude: 137.828882, summary: "地域づくり活動と学びの拠点。", phone: "0538-38-0181", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0005" } },
  { id: "iwata:community:2", dataset: "community", sourceRecordId: "2", name: "大藤交流センター", address: "磐田市大久保279-2", latitude: 34.776927, longitude: 137.847537, summary: "地域づくり活動と学びの拠点。", phone: "0538-38-0371", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0002" } },
  { id: "iwata:community:3", dataset: "community", sourceRecordId: "3", name: "向笠交流センター", address: "磐田市向笠竹之内372-1", latitude: 34.762021, longitude: 137.877632, summary: "地域づくり活動と学びの拠点。", phone: "0538-38-0216", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0013" } },
  { id: "iwata:community:4", dataset: "community", sourceRecordId: "4", name: "田原交流センター", address: "磐田市三ケ野1045-3", latitude: 34.733361, longitude: 137.887942, summary: "地域づくり活動と学びの拠点。", phone: "0538-35-4269", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0027" } },
  { id: "iwata:community:5", dataset: "community", sourceRecordId: "5", name: "御厨交流センター", address: "磐田市鎌田1876", latitude: 34.711194, longitude: 137.885813, summary: "地域づくり活動と学びの拠点。", phone: "0538-32-3050", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0038" } },
  { id: "iwata:community:6", dataset: "community", sourceRecordId: "6", name: "南御厨交流センター", address: "磐田市東新屋613", latitude: 34.701876, longitude: 137.891607, summary: "地域づくり活動と学びの拠点。", phone: "0538-35-0982", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0035" } },
  { id: "iwata:community:7", dataset: "community", sourceRecordId: "7", name: "西貝交流センター", address: "磐田市西貝塚1377-5", latitude: 34.711791, longitude: 137.87341, summary: "地域づくり活動と学びの拠点。", phone: "0538-32-4853", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0026" } },
  { id: "iwata:community:8", dataset: "community", sourceRecordId: "8", name: "南交流センター", address: "磐田市下岡田142-1", latitude: 34.693662, longitude: 137.849667, summary: "地域づくり活動と学びの拠点。", phone: "0538-32-9623", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0046" } },
  { id: "iwata:community:9", dataset: "community", sourceRecordId: "9", name: "長野交流センター", address: "磐田市小島374", latitude: 34.683743, longitude: 137.830383, summary: "地域づくり活動と学びの拠点。", phone: "0538-32-5421", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0056" } },
  { id: "iwata:community:10", dataset: "community", sourceRecordId: "10", name: "見付交流センター", address: "磐田市見付2385-10", latitude: 34.728783, longitude: 137.859448, summary: "地域づくり活動と学びの拠点。", phone: "0538-32-0322", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0086" } },
  { id: "iwata:community:11", dataset: "community", sourceRecordId: "11", name: "中泉交流センター", address: "磐田市中泉2404-1", latitude: 34.713482, longitude: 137.845778, summary: "地域づくり活動と学びの拠点。", phone: "0538-35-3356", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0078" } },
  { id: "iwata:community:12", dataset: "community", sourceRecordId: "12", name: "福田中央交流センター", address: "磐田市福田1587-1", latitude: 34.679198, longitude: 137.878835, summary: "地域づくり活動と学びの拠点。", phone: "0538-58-1111", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "437-1203" } },
  { id: "iwata:community:13", dataset: "community", sourceRecordId: "13", name: "福田南交流センター", address: "磐田市福田5489-2", latitude: 34.6670907, longitude: 137.8813936, summary: "地域づくり活動と学びの拠点。", phone: "0538-55-3123", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "437-1203" } },
  { id: "iwata:community:14", dataset: "community", sourceRecordId: "14", name: "竜洋交流センター", address: "磐田市岡783-1", latitude: 34.6779435, longitude: 137.8174427, summary: "地域づくり活動と学びの拠点。", phone: "0538-66-9103", detailUrl: null, sourceUrl: communitySource, sourceUpdatedAt: "2022-10-28", attributes: { postalCode: "438-0292" } },

  { id: "iwata:cultural:BB00000001", dataset: "cultural", sourceRecordId: "BB00000001", name: "遠江国分寺跡", address: null, latitude: null, longitude: null, summary: "文化財オープンデータに掲載。位置情報は公開データ上で要補完。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000002", dataset: "cultural", sourceRecordId: "BB00000002", name: "銚子塚古墳附小銚子塚古墳", address: null, latitude: null, longitude: null, summary: "文化財オープンデータに掲載。位置情報は公開データ上で要補完。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000003", dataset: "cultural", sourceRecordId: "BB00000003", name: "旧見付学校附磐田文庫", address: null, latitude: null, longitude: null, summary: "文化財オープンデータと観光施設データの接続候補。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true, samePlaceCandidate: "iwata:tourism:9" } },
  { id: "iwata:cultural:BB00000004", dataset: "cultural", sourceRecordId: "BB00000004", name: "新豊院山古墳群", address: null, latitude: null, longitude: null, summary: "文化財オープンデータに掲載。位置情報は公開データ上で要補完。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000005", dataset: "cultural", sourceRecordId: "BB00000005", name: "御厨古墳群", address: null, latitude: null, longitude: null, summary: "文化財オープンデータに掲載。位置情報は公開データ上で要補完。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000006", dataset: "cultural", sourceRecordId: "BB00000006", name: "熊野の長フジ", address: null, latitude: null, longitude: null, summary: "文化財オープンデータに掲載。位置情報は公開データ上で要補完。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000011", dataset: "cultural", sourceRecordId: "BB00000011", name: "大箸家住宅北土蔵", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置・関連施設の接続候補。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000012", dataset: "cultural", sourceRecordId: "BB00000012", name: "大箸家住宅南土蔵", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置・関連施設の接続候補。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000013", dataset: "cultural", sourceRecordId: "BB00000013", name: "大箸家住宅納屋", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置・関連施設の接続候補。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000014", dataset: "cultural", sourceRecordId: "BB00000014", name: "大箸家住宅井戸小屋", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置・関連施設の接続候補。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000017", dataset: "cultural", sourceRecordId: "BB00000017", name: "天竜浜名湖鉄道神田隧道", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置情報を要確認。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
  { id: "iwata:cultural:BB00000018", dataset: "cultural", sourceRecordId: "BB00000018", name: "旧掛塚郵便局（長谷川家住宅）局舎", address: null, latitude: null, longitude: null, summary: "登録有形文化財。公開データ上の位置情報を要確認。", phone: null, detailUrl: null, sourceUrl: culturalSource, sourceUpdatedAt: "2024-03-26", attributes: { needsLocationReview: true } },
] as const;

export function iwataDatasetLabel(dataset: IwataDatasetKey): string {
  return IWATA_DATASETS.find((entry) => entry.key === dataset)?.label ?? dataset;
}

export function buildIwataOpenDataSummary(items: readonly IwataOpenDataItem[] = IWATA_OPEN_DATA_ITEMS) {
  const mappedCount = items.filter((item) => item.latitude !== null && item.longitude !== null).length;
  const missingLocationCount = items.length - mappedCount;
  const byDataset = Object.fromEntries(
    IWATA_DATASETS.map((dataset) => [dataset.key, items.filter((item) => item.dataset === dataset.key).length]),
  ) as Record<IwataDatasetKey, number>;
  return {
    totalCount: items.length,
    mappedCount,
    missingLocationCount,
    datasetCount: IWATA_DATASETS.length,
    byDataset,
  };
}

export function filterIwataOpenDataItems(input: {
  dataset?: string | null;
  query?: string | null;
  limit?: number | null;
}): IwataOpenDataItem[] {
  const dataset = IWATA_DATASETS.some((entry) => entry.key === input.dataset)
    ? input.dataset as IwataDatasetKey
    : null;
  const query = String(input.query ?? "").trim().toLocaleLowerCase("ja-JP").slice(0, 80);
  const limit = Number.isFinite(input.limit) ? Math.min(Math.max(Math.trunc(input.limit ?? 200), 1), 500) : 200;

  return IWATA_OPEN_DATA_ITEMS.filter((item) => {
    if (dataset && item.dataset !== dataset) return false;
    if (!query) return true;
    const haystack = [item.name, item.address, item.summary, iwataDatasetLabel(item.dataset)]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ja-JP");
    return haystack.includes(query);
  }).slice(0, limit);
}
