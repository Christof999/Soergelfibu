export interface EmailVars {
  customerName: string;
  companyName: string;
  websiteUrl: string;
  ctaUrl: string;
  /** Exakt 3 Optimierungen aus der KI-Analyse oder Fallback-Texte */
  optimierungen: [string, string, string];
  preheader?: string;
  subject: string;
}

const FALLBACK_OPT: [string, string, string] = [
  'Mobile wirkt nicht wie ein gepflegter Auftritt. Über 60 % Ihrer Besucher kommen vom Smartphone — dort zählt jede Sekunde.',
  'Google findet Sie für die wichtigen Begriffe nicht. Titel, Meta-Daten und Struktur sagen zu wenig über Ihr Angebot.',
  'Das Erscheinungsbild passt nicht mehr zur Qualität Ihrer Arbeit. Besucher entscheiden in 0,05 Sekunden, ob ein Unternehmen seriös wirkt.',
];

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  );
}

function opt(idx: number, title: string, body: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-bottom:56px;">
  <tr>
    <td width="56" valign="top" style="width:56px;padding-right:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="width:40px;height:40px;background:#F5F3EF;border-radius:10px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#0A0A0A;text-align:center;line-height:40px;font-weight:400;">0${idx}</td>
      </tr></table>
    </td>
    <td valign="top">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#0A0A0A;padding-bottom:10px;letter-spacing:-0.01em;line-height:1.35;">${esc(title)}</div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#5A544B;">${esc(body)}</div>
    </td>
  </tr>
</table>`;
}

/** Aus einem Optimierungs-String Titel + Body extrahieren (Trennzeichen: Punkt / Strich) */
function splitOpt(raw: string): { title: string; body: string } {
  // Versuche am ersten Satzende zu trennen
  const dotIdx = raw.search(/[.!?]/);
  if (dotIdx > 10 && dotIdx < raw.length - 10) {
    return {
      title: raw.slice(0, dotIdx + 1).trim(),
      body: raw.slice(dotIdx + 1).trim(),
    };
  }
  // Fallback: erste 60 Zeichen als Titel
  const words = raw.split(' ');
  let title = '';
  let i = 0;
  while (i < words.length && title.length < 60) { title += (title ? ' ' : '') + words[i++]; }
  return { title: title || raw, body: words.slice(i).join(' ') };
}

export function buildEmailHtml(vars: EmailVars): string {
  const opts = vars.optimierungen.length === 3
    ? vars.optimierungen
    : FALLBACK_OPT;

  const parsed = opts.map(o => splitOpt(o)) as [
    { title: string; body: string },
    { title: string; body: string },
    { title: string; body: string }
  ];

  const preheader = vars.preheader
    ?? `3 konkrete Punkte auf ${vars.websiteUrl}, die Sie heute Kunden kosten — 15 Min. Gespräch, kostenlos.`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(vars.subject)}</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;line-height:100%;outline:none;text-decoration:none}
  table{border-collapse:collapse!important}
  body{margin:0!important;padding:0!important;width:100%!important;background:#F5F3EF}
  a{color:#111111}
  @media screen and (max-width:600px){
    .container{width:100%!important}
    .px{padding-left:24px!important;padding-right:24px!important}
    .h1{font-size:28px!important;line-height:1.15!important}
    .cta-btn{width:100%!important;box-sizing:border-box}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<div style="display:none;font-size:1px;color:#F5F3EF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3EF;">
  <tr>
    <td align="center" style="padding:32px 16px 48px 16px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#0A0A0A;border-radius:18px 18px 0 0;padding:28px 36px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.08em;color:#FFFFFF;font-weight:400;">
                  SØRGEL<span style="color:#C94A1C;">·</span>design
                </td>
                <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;color:#9A928A;text-transform:uppercase;">
                  Kurzanalyse
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="background:#FFFFFF;padding:48px 48px 8px 48px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#8A8178;text-transform:uppercase;padding-bottom:18px;">
                  <span style="display:inline-block;width:24px;height:1px;background:#C94A1C;vertical-align:middle;margin-right:10px;"></span>Analyse · ${esc(vars.companyName)}
                </td>
              </tr>
              <tr>
                <td class="h1" style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.1;color:#0A0A0A;font-weight:400;letter-spacing:-0.01em;padding-bottom:20px;">
                  Ihre Website <span style="color:#8A8178;">verschenkt</span><br>gerade Kunden.
                </td>
              </tr>
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#3A3A3A;padding-bottom:28px;">
                  Hallo ${esc(vars.customerName)},<br><br>
                  ich habe mir <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> angesehen. Drei Punkte kosten Sie messbar Anfragen — lassen sich in wenigen Wochen lösen.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="background:#FFFFFF;padding:0 48px;" class="px">
            <div style="height:1px;background:#EBE6DE;line-height:1px;font-size:1px;">&nbsp;</div>
          </td>
        </tr>

        <!-- 3 Findings -->
        <tr>
          <td style="background:#FFFFFF;padding:40px 48px 16px 48px;" class="px">
            ${opt(1, parsed[0].title, parsed[0].body)}
            ${opt(2, parsed[1].title, parsed[1].body)}
            ${opt(3, parsed[2].title, parsed[2].body)}
          </td>
        </tr>

        <!-- Accent quote -->
        <tr>
          <td style="background:#FFFFFF;padding:16px 48px 40px 48px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;border-radius:14px;">
              <tr>
                <td style="padding:28px 32px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#C94A1C;text-transform:uppercase;padding-bottom:10px;">Mein Angebot</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#FFFFFF;font-weight:400;">
                    15 Minuten am Telefon. Ich zeige Ihnen die drei Punkte konkret an Ihrer Seite — <span style="color:#BFB8AE;">kein Verkaufsgespräch, kein Haken.</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#FFFFFF;padding:0 48px 48px 48px;" align="left" class="px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:#0A0A0A;border-radius:10px;">
                  <a href="${esc(vars.ctaUrl)}" class="cta-btn" style="display:inline-block;padding:16px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:-0.005em;">
                    Kostenloses 15-Min-Gespräch buchen&nbsp;&nbsp;→
                  </a>
                </td>
                <td style="padding-left:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#8A8178;">
                  oder einfach auf diese Mail antworten.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Signature -->
        <tr>
          <td style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:0 48px 48px 48px;" class="px">
            <div style="height:1px;background:#EBE6DE;line-height:1px;font-size:1px;margin-bottom:28px;">&nbsp;</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#0A0A0A;padding-bottom:4px;">Christof Sörgel</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#5A544B;padding-bottom:14px;">Gründer · SØRGEL-design</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#3A3A3A;">
              <a href="https://www.soergel-design.de" style="color:#0A0A0A;text-decoration:none;">www.soergel-design.de</a><br>
              <span style="color:#8A8178;">Websites · Webapps · Automationen</span>
            </div>
          </td>
        </tr>

      </table>

      <!-- Footer -->
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td style="padding:24px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9A928A;" class="px" align="center">
            Sie erhalten diese Mail einmalig, weil ich Ihre Website öffentlich recherchiert habe. Kein Newsletter. Keine Weitergabe.<br>
            <a href="mailto:hallo@soergel-design.de?subject=Bitte%20nicht%20kontaktieren" style="color:#9A928A;text-decoration:underline;">Nicht mehr kontaktieren</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

export function buildSubject(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `Kurzanalyse ${domain || lead.name} — 3 konkrete Punkte`;
}

export function buildPlainText(vars: EmailVars): string {
  const opts = vars.optimierungen.length === 3 ? vars.optimierungen : FALLBACK_OPT;
  return `Hallo ${vars.customerName},

ich habe mir ${vars.websiteUrl} angesehen. Drei Punkte kosten Sie messbar Anfragen:

01 · ${opts[0]}

02 · ${opts[1]}

03 · ${opts[2]}

Mein Angebot: 15 Minuten am Telefon. Ich zeige Ihnen die drei Punkte konkret an Ihrer Seite — kein Verkaufsgespräch, kein Haken.

Termin buchen: ${vars.ctaUrl}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
}
