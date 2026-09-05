import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]!));

function deleteCopy(lang: SiteLang) {
  return ({
    ja: { label: "この記録を一覧から外す", button: "削除", hint: "一覧と公開ページから外します。写真ファイルは監査用に残します。", confirm: "もう一度押して削除", confirmHint: "一覧と公開ページから外します。取り消す場合はそのまま待ってください。", working: "削除中...", done: "削除しました。記録一覧へ戻ります。", failed: "削除できませんでした: " },
    en: { label: "Remove this record", button: "Delete", hint: "Removes the record from lists and public pages. Media is retained for audit.", confirm: "Press again to delete", confirmHint: "Removes it from lists and public pages. Wait to cancel.", working: "Deleting...", done: "Deleted. Returning to your records.", failed: "Could not delete: " },
    es: { label: "Quitar este registro", button: "Eliminar", hint: "Se retira de las listas y páginas públicas. Los archivos se conservan para auditoría.", confirm: "Pulsa otra vez para eliminar", confirmHint: "Se retira de las listas y páginas públicas. Espera para cancelar.", working: "Eliminando...", done: "Eliminado. Volviendo a tus registros.", failed: "No se pudo eliminar: " },
    "pt-BR": { label: "Remover este registro", button: "Excluir", hint: "Remove das listas e páginas públicas. Os arquivos são mantidos para auditoria.", confirm: "Pressione novamente para excluir", confirmHint: "Remove das listas e páginas públicas. Aguarde para cancelar.", working: "Excluindo...", done: "Excluído. Voltando aos seus registros.", failed: "Não foi possível excluir: " },
  })[lang];
}

export function renderObservationOwnerDeletePanel(options: {
  basePath: string;
  visitId: string;
  isOwner: boolean;
  lang: SiteLang;
}): string {
  if (!options.isOwner) return "";
  const copy = deleteCopy(options.lang);
  const endpoint = withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.visitId)}/hide`);
  const notesHref = appendLangToHref(withBasePath(options.basePath, "/records?view=mine"), options.lang);
  return `<section class="section obs-owner-tool obs-owner-delete" data-owner-delete data-delete-endpoint="${escapeHtml(endpoint)}" data-after-delete-href="${escapeHtml(notesHref)}" title="${escapeHtml(copy.hint)}">
    <span class="obs-owner-tool-label">${escapeHtml(copy.label)}</span>
    <button type="button" class="obs-owner-delete-button" data-owner-delete-button>${escapeHtml(copy.button)}</button>
    <small class="obs-owner-delete-note">${escapeHtml(copy.hint)}</small>
    <span class="obs-owner-delete-status" data-owner-delete-status aria-live="polite"></span>
  </section>`;
}

export function renderObservationOwnerDeleteScript(isOwner: boolean, lang: SiteLang = "ja"): string {
  if (!isOwner) return "";
  return `<script data-owner-delete-script>(function(){
    var copy = ${JSON.stringify(deleteCopy(lang))};
    var root = document.querySelector('[data-owner-delete]');
    if (!root) return;
    var button = root.querySelector('[data-owner-delete-button]');
    var status = root.querySelector('[data-owner-delete-status]');
    var endpoint = root.getAttribute('data-delete-endpoint') || '';
    var nextHref = root.getAttribute('data-after-delete-href') || '/records?view=mine';
    var confirmDelete = false;
    var confirmTimer = null;
    var setStatus = function(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    };
    if (!button || !endpoint) return;
    button.addEventListener('click', function() {
      if (!confirmDelete) {
        confirmDelete = true;
        button.textContent = copy.confirm;
        setStatus(copy.confirmHint, false);
        if (confirmTimer) window.clearTimeout(confirmTimer);
        confirmTimer = window.setTimeout(function(){
          confirmDelete = false;
          button.textContent = copy.button;
          setStatus('', false);
        }, 5200);
        return;
      }
      if (confirmTimer) window.clearTimeout(confirmTimer);
      button.disabled = true;
      setStatus(copy.working, false);
      fetch(endpoint, {
        method: 'POST',
        headers: { accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin'
      }).then(function(response) {
        return response.json().catch(function(){ return {}; }).then(function(json) {
          if (!response.ok || !json || json.ok === false) {
            throw new Error(String((json && json.error) || response.status || 'delete_failed'));
          }
          setStatus(copy.done, false);
          setTimeout(function(){ window.location.href = nextHref; }, 700);
        });
      }).catch(function(error) {
        setStatus(copy.failed + String(error && error.message || 'network'), true);
        button.disabled = false;
      });
    });
  })();</script>`;
}
