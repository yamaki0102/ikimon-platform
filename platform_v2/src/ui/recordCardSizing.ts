export const RECORD_CARD_SIZING_TOKENS = `
:root {
  --ikimon-record-card-min-w: 176px;
  --ikimon-record-card-grid-fluid: repeat(auto-fill, minmax(var(--ikimon-record-card-min-w), 1fr));
  --ikimon-record-card-grid-desktop: repeat(6, minmax(0, 1fr));
  --ikimon-record-card-grid-tablet: repeat(3, minmax(0, 1fr));
  --ikimon-record-card-grid-mobile: repeat(2, minmax(0, 1fr));
  --ikimon-record-card-grid-gap-fluid: 18px 14px;
  --ikimon-record-card-grid-gap-desktop: 20px 14px;
  --ikimon-record-card-grid-gap-tablet: 16px 12px;
  --ikimon-record-card-grid-gap-mobile: 20px 13px;
  --ikimon-record-card-grid-gap-compact: 21px 12px;
  --ikimon-record-card-inner-gap: 9px;
  --ikimon-record-card-inner-gap-mobile: 8px;
  --ikimon-record-card-body-gap: 7px;
  --ikimon-record-card-body-gap-mobile: 8px;
  --ikimon-record-card-thumb-ratio: 4 / 5;
  --ikimon-record-card-thumb-radius: 8px;
  --ikimon-record-card-thumb-radius-mobile: 7px;
  --ikimon-record-card-thumb-shadow: 0 10px 24px rgba(15,23,42,.07);
  --ikimon-record-card-thumb-shadow-mobile: 0 8px 18px rgba(15,23,42,.07);
  --ikimon-record-card-title-size: 15px;
  --ikimon-record-card-title-line-height: 1.35;
  --ikimon-record-card-title-size-mobile: 13px;
  --ikimon-record-card-title-line-height-mobile: 1.34;
  --ikimon-record-card-meta-size: 10px;
  --ikimon-record-card-meta-line-height: 1.25;
}
`;
