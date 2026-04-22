import type { OptimierungPunkt } from '../types';

export interface EmailVars {
  customerName: string;
  companyName: string;
  websiteUrl: string;
  /** Exakt 3 Punkte: Überschrift + Kunden-Empfehlung (für E-Mail-Template) */
  optimierungen: [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt];
  /**
   * Wenn die Website nicht erreichbar war: ein zusammenhängender Ansprache-Text statt der drei Punkte.
   * Wenn gesetzt (nicht leer), wird dieser Block statt der nummerierten Empfehlungen gerendert.
   */
  akquiseOhneWebsiteText?: string;
  /** Kurzvorstellung (Christof) — nach den drei Punkten, vor dem Call-to-Action */
  vorstellung?: string;
  preheader?: string;
  subject: string;
}

export const DEFAULT_EMAIL_VORSTELLUNG = `Mein Name ist Christof — ich weiß aus der Praxis, worauf es bei mittelständischen Handwerksbetrieben ankommt. Ich stehe Ihnen persönlich zur Verfügung: Gemeinsam können wir Ihre Abläufe mit smarten Anwendungen im Unternehmen verbessern und Prozesse spürbar effizienter machen.`;

/** Call-to-Action: Kontaktformular (Akquise-E-Mail) */
export const DEFAULT_AKQUISE_KONTAKT_URL = 'https://soergel-design.de/kontakt';

const FALLBACK_OPT: [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt] = [
  {
    titel: 'Mobile Nutzung',
    empfehlung:
      'Über die Hälfte Ihrer Besucher kommt vom Smartphone — dort entscheidet sich oft in Sekunden, ob jemand bleibt oder abspringt. Prüfen Sie die Darstellung auf kleinen Screens und die Ladezeiten gezielt.',
  },
  {
    titel: 'Auffindbarkeit bei Google',
    empfehlung:
      'Titel, Kurzbeschreibung und Überschriften sollten klar sagen, was Sie anbieten und wo Sie tätig sind — das hilft Suchmaschinen und Besuchern gleichermaßen.',
  },
  {
    titel: 'Erster Eindruck & Vertrauen',
    empfehlung:
      'Besucher bewerten Seriosität sehr schnell. Ein konsistentes Erscheinungsbild und klare nächste Schritte (z. B. Kontakt, Termin) erhöhen die Bereitschaft zur Anfrage.',
  },
];

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  );
}

/** Fließtext mit Absätzen (nach esc) als HTML-Absätze */
function paragraphsFromEsc(escapedPlain: string): string {
  const parts = escapedPlain.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const pStyle =
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3A3A3A;margin:0 0 16px 0;';
  return parts
    .map(p => `<p style="${pStyle}">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
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

export function buildEmailHtml(vars: EmailVars): string {
  const flussRaw = (vars.akquiseOhneWebsiteText ?? '').trim();
  const useFluss = flussRaw.length > 0;

  const opts =
    vars.optimierungen?.length === 3 ? vars.optimierungen : FALLBACK_OPT;

  const parsed = opts.map((p, i) => ({
    title: (p.titel ?? '').trim() || `Empfehlung ${i + 1}`,
    body: (p.empfehlung ?? '').trim(),
  })) as [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }];

  const preheader = vars.preheader
    ?? (useFluss
      ? `Leistungen rund um Web, WebApps, Media & Druck — Kontakt über soergel-design.de/kontakt.`
      : `Drei konkrete Punkte zu ${vars.websiteUrl} — Kontakt über soergel-design.de/kontakt.`);

  const vorstellung = (vars.vorstellung ?? DEFAULT_EMAIL_VORSTELLUNG).trim();

  const findingsBlock = useFluss
    ? `
        <tr>
          <td style="background:#FFFFFF;padding:40px 48px 16px 48px;" class="px">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;color:#8A8178;text-transform:uppercase;padding-bottom:14px;">Persönliche Ansprache</div>
            ${paragraphsFromEsc(esc(flussRaw))}
          </td>
        </tr>`
    : `
        <tr>
          <td style="background:#FFFFFF;padding:40px 48px 16px 48px;" class="px">
            ${opt(1, parsed[0].title, parsed[0].body)}
            ${opt(2, parsed[1].title, parsed[1].body)}
            ${opt(3, parsed[2].title, parsed[2].body)}
          </td>
        </tr>`;

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
                  ${useFluss
                    ? `So können wir <span style="color:#8A8178;">${esc(vars.companyName)}</span><br>digital unterstützen.`
                    : `Ihre Website <span style="color:#8A8178;">verschenkt</span><br>gerade Kunden.`}
                </td>
              </tr>
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#3A3A3A;padding-bottom:28px;">
                  Hallo ${esc(vars.customerName)},<br><br>
                  ${useFluss
                    ? `ich wollte mir <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> ansehen — der Abruf ist technisch gerade nicht gelungen (z.&nbsp;B. Bot-Schutz, Wartung oder Timeout). Darum schreibe ich Ihnen kurz direkt, woran ich mit SØRGEL-design arbeite und wie das zu Ihrem Betrieb passen kann:`
                    : `ich habe mir <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> angesehen. Drei Punkte kosten Sie messbar Anfragen — lassen sich in wenigen Wochen lösen.`}
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

        <!-- 3 Findings oder Fließtext (Website nicht erreichbar) -->
        ${findingsBlock}

        <!-- Kurzvorstellung -->
        <tr>
          <td style="background:#FFFFFF;padding:0 48px 32px 48px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3EF;border-radius:12px;border:1px solid #EBE6DE;">
              <tr>
                <td style="padding:22px 26px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;color:#8A8178;text-transform:uppercase;padding-bottom:10px;">Kurz zu mir</div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3A3A3A;">${esc(vorstellung)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Nächster Schritt: Kontaktformular -->
        <tr>
          <td style="background:#FFFFFF;padding:16px 48px 48px 48px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;border-radius:14px;">
              <tr>
                <td style="padding:28px 32px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#C94A1C;text-transform:uppercase;padding-bottom:10px;">Nächster Schritt</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#FFFFFF;font-weight:400;padding-bottom:18px;">
                    Schreiben Sie mir gern über das <span style="color:#BFB8AE;">Kontaktformular</span> — dann besprechen wir gemeinsam das weitere Vorgehen und ich übernehme die Umsetzung gerne im Auftrag für Sie.
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="border-radius:10px;background:#C94A1C;" align="center">
                        <a href="${DEFAULT_AKQUISE_KONTAKT_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Zum Kontaktformular</a>
                      </td>
                    </tr>
                  </table>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#9A928A;padding-top:14px;">
                    <a href="${DEFAULT_AKQUISE_KONTAKT_URL}" target="_blank" rel="noopener noreferrer" style="color:#BFB8AE;text-decoration:underline;text-underline-offset:2px;">${esc(DEFAULT_AKQUISE_KONTAKT_URL)}</a>
                  </div>
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

/** Betreff wenn die Website nicht geladen werden konnte (Fließtext-Ansprache) */
export function buildSubjectOhneWebsiteErreichbar(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `Kurze Vorstellung — Web, WebApps, Media & Druck für ${domain || lead.name}`;
}

export function buildPlainText(vars: EmailVars): string {
  const vorstellung = (vars.vorstellung ?? DEFAULT_EMAIL_VORSTELLUNG).trim();
  const fluss = (vars.akquiseOhneWebsiteText ?? '').trim();
  const useFluss = fluss.length > 0;

  if (useFluss) {
    return `Hallo ${vars.customerName},

ich wollte mir ${vars.websiteUrl} ansehen — der Abruf ist technisch gerade nicht gelungen (z. B. Bot-Schutz, Wartung oder Timeout).

${fluss}

${vorstellung}

Nächster Schritt: Schreiben Sie mir gern über das Kontaktformular — dann besprechen wir Ihr Anliegen und ich übernehme die Umsetzung gerne im Auftrag für Sie.
${DEFAULT_AKQUISE_KONTAKT_URL}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
  }

  const opts = vars.optimierungen?.length === 3 ? vars.optimierungen : FALLBACK_OPT;
  const lines = opts.map((p, i) => {
    const t = p.titel?.trim() || `Punkt ${i + 1}`;
    const e = p.empfehlung?.trim() || '';
    return `0${i + 1} · ${t}\n   ${e}`;
  });
  return `Hallo ${vars.customerName},

ich habe mir ${vars.websiteUrl} angesehen. Drei Punkte kosten Sie messbar Anfragen:

${lines.join('\n\n')}

${vorstellung}

Nächster Schritt: Schreiben Sie mir gern über das Kontaktformular — dann besprechen wir die drei Punkte und ich übernehme die Umsetzung gerne im Auftrag für Sie.
${DEFAULT_AKQUISE_KONTAKT_URL}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
}
