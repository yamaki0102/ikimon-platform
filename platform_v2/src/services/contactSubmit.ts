import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { getPool } from "../db.js";

export type ContactSubmitInput = {
  category: string;
  name?: string;
  email?: string;
  organization?: string;
  message: string;
  sourceUrl?: string;
  userAgent?: string;
  ip?: string;
  userId?: string | null;
};

export type ContactSubmitResult = {
  submissionId: string;
  notificationSent: boolean;
  autoReplySent: boolean;
};

const ADMIN_TO = "yamaki0102@gmail.com";
const NOREPLY_FROM = "ikimon <noreply@ikimon.life>";

const CATEGORY_LABELS: Record<string, { icon: string; label: string; reply: string }> = {
  bug:         { icon: "🐛", label: "バグ報告",   reply: "バグ報告をいただきありがとうございます。\n詳細を確認し、修正に向けて取り組みます。" },
  improvement: { icon: "💡", label: "要望・提案", reply: "ご要望・ご提案をいただきありがとうございます。\n内容を確認のうえ、ご返信いたします。" },
  question:    { icon: "❓", label: "質問",       reply: "お問い合わせいただきありがとうございます。\n内容を確認のうえ、ご返信いたします。" },
  partnership: { icon: "🤝", label: "導入・連携", reply: "導入・連携に関するご相談をいただきありがとうございます。\nご要件を確認のうえ、詳細についてあらためてご連絡いたします。" },
  deletion:    { icon: "🗑️", label: "データ削除", reply: "データ削除のリクエストをいただきありがとうございます。\n内容を確認のうえ、速やかに対応いたします。" },
  media:       { icon: "📰", label: "取材・メディア", reply: "取材・メディアに関するご依頼をいただきありがとうございます。\n担当者より詳細についてご連絡いたします。" },
  other:       { icon: "💬", label: "その他",     reply: "お問い合わせいただきありがとうございます。\n内容を確認のうえ、ご返信いたします。" },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

function sanitize(value: string | undefined | null, maxLength = 4000): string {
  if (!value) return "";
  return String(value).replace(/\u0000/g, "").slice(0, maxLength).trim();
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeSubjectMime(subject: string): string {
  const buf = Buffer.from(subject, "utf-8").toString("base64");
  return `=?UTF-8?B?${buf}?=`;
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  // CRLF / tab / null byte を含むアドレスはヘッダインジェクション対策で即拒否。
  if (/[\r\n\t\0]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendMailViaSendmail(to: string, subject: string, body: string, extraHeaders: Record<string, string> = {}): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {
      From: NOREPLY_FROM,
      To: to,
      Subject: encodeSubjectMime(subject),
      "MIME-Version": "1.0",
      "Content-Type": "text/plain; charset=UTF-8",
      "Content-Transfer-Encoding": "8bit",
      ...extraHeaders,
    };
    const headerBlock = Object.entries(headers)
      .map(([k, v]) => `${k}: ${sanitizeHeaderValue(v)}`)
      .join("\r\n");
    const payload = `${headerBlock}\r\n\r\n${body}\r\n`;

    // /usr/sbin/sendmail は VPS では msmtp-mta へのシンボリックリンク。
    // -t で宛先をヘッダから拾い、-i でドット単独行で終端しない。
    const child = spawn("/usr/sbin/sendmail", ["-t", "-i"], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: `spawn: ${err.message}` });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: `exit ${code}: ${stderr.slice(0, 500)}` });
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

function buildAdminNotification(input: ContactSubmitInput, submissionId: string): { subject: string; body: string; replyTo?: string } {
  const meta = (CATEGORY_LABELS[input.category] ?? CATEGORY_LABELS.other)!;
  const nameOrg = [input.name?.trim(), input.organization?.trim()].filter(Boolean).join(" / ") || "ゲスト";
  const emailLine = input.email?.trim() || "未入力";
  const body = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  ikimon お問い合わせ通知",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `カテゴリ : ${meta.icon} ${meta.label}`,
    `送信者   : ${nameOrg}`,
    `メール   : ${emailLine}`,
    `日時     : ${new Date().toISOString()}`,
    `ID       : ${submissionId}`,
    "",
    "─── お問い合わせ内容 ───────────────────────",
    "",
    input.message,
    "",
    "─── メタ情報 ───────────────────────────────",
    "",
    `URL      : ${input.sourceUrl ?? ""}`,
    `UA       : ${input.userAgent ?? ""}`,
    `User ID  : ${input.userId ?? "anonymous"}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
  const subject = `[ikimon] ${meta.icon} ${meta.label}: ${input.message.slice(0, 40)}`;
  return {
    subject,
    body,
    replyTo: isValidEmail(input.email ?? "") ? input.email : undefined,
  };
}

function buildAutoReply(input: ContactSubmitInput, submissionId: string): { subject: string; body: string } {
  const meta = (CATEGORY_LABELS[input.category] ?? CATEGORY_LABELS.other)!;
  const firstName = input.name?.trim().split(/\s+/)[0] ?? "お客様";
  const body = [
    `${firstName} 様`,
    "",
    meta.reply,
    "",
    "通常 1〜3 営業日以内にご返信します。",
    "しばらくお待ちくださいますよう、よろしくお願いいたします。",
    "",
    "─── 受付内容 ───────────────────────────────",
    "",
    `受付番号 : ${submissionId}`,
    `カテゴリ : ${meta.icon} ${meta.label}`,
    "",
    "お問い合わせ内容:",
    input.message,
    "",
    "──────────────────────────────────────────",
    "",
    "※ このメールは自動送信です。このメールへの返信は受け付けていません。",
    "   お問い合わせは https://ikimon.life/contact からお願いします。",
    "",
    "ikimon 運営チーム",
    "https://ikimon.life",
  ].join("\n");
  return {
    subject: "[ikimon] お問い合わせを受け付けました",
    body,
  };
}

export async function submitContact(rawInput: ContactSubmitInput): Promise<ContactSubmitResult> {
  const category = sanitize(rawInput.category, 32);
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error("invalid_category");
  }
  const message = sanitize(rawInput.message, 8000);
  if (message.length < 5) {
    throw new Error("message_too_short");
  }

  const input: ContactSubmitInput = {
    category,
    name: sanitize(rawInput.name, 200),
    email: sanitize(rawInput.email, 200),
    organization: sanitize(rawInput.organization, 200),
    message,
    sourceUrl: sanitize(rawInput.sourceUrl, 500),
    userAgent: sanitize(rawInput.userAgent, 500),
    ip: rawInput.ip,
    userId: rawInput.userId ?? null,
  };

  if (input.email && !isValidEmail(input.email)) {
    throw new Error("invalid_email");
  }

  const pool = getPool();
  const ipHash = input.ip ? createHash("sha256").update(input.ip).digest("hex").slice(0, 16) : "";
  const insert = await pool.query<{ submission_id: string }>(
    `insert into contact_submissions
       (category, name, email, organization, message, source_url, user_agent, ip_hash, user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning submission_id`,
    [
      input.category,
      input.name ?? "",
      input.email ?? "",
      input.organization ?? "",
      input.message,
      input.sourceUrl ?? "",
      input.userAgent ?? "",
      ipHash,
      input.userId,
    ],
  );
  const submissionId = insert.rows[0]!.submission_id;

  // 管理者通知
  const adminMail = buildAdminNotification(input, submissionId);
  const adminExtra: Record<string, string> = {};
  // Reply-To は isValidEmail で CRLF 排除済だが、念のため sanitizeHeaderValue を重ね掛け
  // （defense-in-depth: 将来 isValidEmail の定義が弱くなっても守られる）。
  if (adminMail.replyTo) adminExtra["Reply-To"] = sanitizeHeaderValue(adminMail.replyTo);
  const adminResult = await sendMailViaSendmail(ADMIN_TO, adminMail.subject, adminMail.body, adminExtra);

  // 自動返信（メール入力時のみ）
  let autoReplyResult: { ok: boolean; error?: string } = { ok: false };
  if (input.email && isValidEmail(input.email)) {
    const replyMail = buildAutoReply(input, submissionId);
    autoReplyResult = await sendMailViaSendmail(input.email, replyMail.subject, replyMail.body);
  }

  // 結果を DB に反映
  const sendError = [
    !adminResult.ok ? `admin: ${adminResult.error}` : null,
    input.email && !autoReplyResult.ok ? `auto_reply: ${autoReplyResult.error}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  if (adminResult.ok || autoReplyResult.ok || sendError) {
    await pool.query(
      `update contact_submissions
          set notification_sent = $2,
              auto_reply_sent = $3,
              send_error = $4
        where submission_id = $1`,
      [submissionId, adminResult.ok, autoReplyResult.ok, sendError],
    );
  }

  return {
    submissionId,
    notificationSent: adminResult.ok,
    autoReplySent: autoReplyResult.ok,
  };
}
