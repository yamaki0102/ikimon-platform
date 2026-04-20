type ObserverNameSqlOptions = {
  userIdExpr: string;
  displayNameExpr: string;
  sourcePayloadExpr?: string;
  guestFallback?: string;
  defaultFallback?: string;
};

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Read-side guard for synthetic imported names such as `user_xxx`.
 *
 * Some staging / imported rows still carry machine ids in `users.display_name`.
 * Public views should prefer an embedded legacy `user_name` from visit payloads
 * before falling back to a generic label.
 */
export function buildObserverNameSql(options: ObserverNameSqlOptions): string {
  const guestFallback = quoteSqlString(options.guestFallback ?? "Guest");
  const defaultFallback = quoteSqlString(options.defaultFallback ?? "Observer");
  const payloadFallback = options.sourcePayloadExpr
    ? `nullif(btrim(coalesce(${options.sourcePayloadExpr}->>'user_display_name', ${options.sourcePayloadExpr}->>'user_name')), '')`
    : "null";

  return `
    coalesce(
      nullif(
        case
          when ${options.displayNameExpr} is null then null
          when btrim(${options.displayNameExpr}) = '' then null
          when ${options.userIdExpr} is not null
            and lower(btrim(${options.displayNameExpr})) = lower(btrim(${options.userIdExpr}))
            then null
          when ${options.displayNameExpr} ~ '^(user|guest)_[[:alnum:]_-]+$' then null
          else btrim(${options.displayNameExpr})
        end,
        ''
      ),
      ${payloadFallback},
      case
        when ${options.userIdExpr} like 'guest_%' then ${guestFallback}
        else ${defaultFallback}
      end
    )
  `.trim();
}
