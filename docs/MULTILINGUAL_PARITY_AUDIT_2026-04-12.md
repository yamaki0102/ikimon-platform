# ikimon.life Multilingual Parity Audit

Date: 2026-04-12  
Environment: `https://staging.162-43-44-131.sslip.io/`

## Scope

This audit covers the main public-surface pages that matter for multilingual rollout:

- `/`
- `/about.php`
- `/for-business/`
- `/for-business/apply.php`
- `/explore.php`
- `/fieldscan.php`
- `/demo/`

Languages checked:

- `ja`
- `en`
- `es`
- `pt-BR`

## Result

Verdict: public-surface multilingual parity is complete enough to call done.

Meaning:

- The main public pages above all render in the target language
- Visible high-signal copy is no longer falling back to Japanese on `en / es / pt-BR`
- `fieldscan` and `demo` now also have full `ja / en / es / pt-BR` body copy, not just English fallback

## Evidence

Checked on staging with Basic Auth and confirmed by HTML inspection:

1. `/`
   - `en`: language switch UI and English hero confirmed
   - `es`: Spanish hero confirmed
   - `pt-BR`: Portuguese hero confirmed

2. `/about.php`
   - `en`: English title/body confirmed
   - `es`: Spanish title/body confirmed
   - `pt-BR`: Portuguese title/body confirmed

3. `/for-business/`
   - language switch UI present
   - `en / es / pt-BR` CTA and hero copy confirmed

4. `/for-business/apply.php`
   - `en / es / pt-BR` form, plan guidance, footer, cookie copy confirmed

5. `/explore.php`
   - `en / es / pt-BR` card fallback strings confirmed
   - examples: observation photo alt, unidentified label, load-more CTA

6. `/fieldscan.php`
   - `es`: `Qué registra un paseo`, `Descargar APK`, `Privacidad`
   - `pt-BR`: `O que uma caminhada registra`, `Baixar APK`, `Privacidade`

7. `/demo/`
   - `es`: `Experiencia demo`, `Ver el resumen`, `Qué muestra este demo`
   - `pt-BR`: `Experiência demo`, `Ver o resumo`, `O que este demo mostra`

## Notes

- A few early source-pattern checks returned false negatives because the audit regex expected exact wording that differed slightly from the final translation.
- No blocking multilingual defect remained in the audited public pages after final staging verification.
- This audit does not include:
  - `admin/*`
  - API response text
  - deep logged-in/internal flows beyond already-fixed major components

## Remaining Non-Blocking Work

- Do a visual pass, not just source inspection, on mobile widths for `es / pt-BR`
- Optionally audit second-tier reusable components and old low-traffic pages
- If needed later, split public parity completion from logged-in parity completion in docs

## Files Most Recently Involved

- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/about.php`
- `upload_package/public_html/explore.php`
- `upload_package/public_html/fieldscan.php`
- `upload_package/public_html/demo/index.php`
- `upload_package/public_html/components/nav.php`
- `upload_package/public_html/components/quick_identify.php`
- `upload_package/public_html/components/onboarding.php`
- `upload_package/public_html/components/onboarding_modal.php`
- `upload_package/public_html/components/scan_recommendation_cards.php`
- `upload_package/public_html/components/ui/empty_state.php`
- `upload_package/public_html/components/ui/obs_card.php`
- `upload_package/lang/ja.php`
- `upload_package/lang/en.php`
- `upload_package/lang/es.php`
- `upload_package/lang/pt-br.php`

## Operational Record

Latest audit-related staging backup:

- `/var/www/ikimon.life-staging/backups/20260412-183528`

Current decision:

- It is reasonable to treat multilingual work for the main public surface as finished.
