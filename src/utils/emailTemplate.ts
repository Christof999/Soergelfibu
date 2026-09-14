import type { Lead, OptimierungPunkt } from '../types';
import { normalizeOptimierungenListe } from './leadAnalyse';

export type AkquiseEmailTemplateKind = 'analyse' | 'seo' | 'standard' | 'software';

export interface EmailVars {
  customerName: string;
  companyName: string;
  websiteUrl: string;
  ctaUrl: string;
  /** „analyse“ = Website; „seo“ = SEO-Kurzcheck; „standard“ = Ansprache; „software“ = drei WebApps */
  templateKind: AkquiseEmailTemplateKind;
  /** Nur bei templateKind „standard“: Fließtext zu Leistungen & Zusammenarbeit (Absätze mit Leerzeile) */
  standardLeistungstext?: string;
  /** Exakt 3 Punkte aus der KI-Analyse oder Fallback-Texte („analyse“ / „seo“) — Bearbeitung im Modal */
  optimierungen: [string, string, string];
  /**
   * Nur „analyse“ / „seo“: strukturierte KI-Punkte für HTML/Klartext.
   * Wenn gesetzt, werden Titel und Empfehlung direkt verwendet (ohne splitOpt-Zerlegung der Rohstrings).
   */
  optimierungPunkte?: [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt];
  preheader?: string;
  subject: string;
}

const FALLBACK_OPT: [string, string, string] = [
  'Mobile wirkt nicht wie ein gepflegter Auftritt. Über 60 % Ihrer Besucher kommen vom Smartphone — dort zählt jede Sekunde.',
  'Google findet Sie für die wichtigen Begriffe nicht. Titel, Meta-Daten und Struktur sagen zu wenig über Ihr Angebot.',
  'Das Erscheinungsbild passt nicht mehr zur Qualität Ihrer Arbeit. Besucher entscheiden in 0,05 Sekunden, ob ein Unternehmen seriös wirkt.',
];

const FALLBACK_SEO_OPT: [string, string, string] = [
  'Seitentitel und Meta-Beschreibung sagen zu wenig aus. Google nutzt beides als erstes Signal — Besucher und Suchmaschine wissen nicht, was Sie genau anbieten.',
  'Die Überschriftenstruktur ist unklar. Eine eindeutige H1 und sinnvolle Zwischenüberschriften helfen Google, Ihr Angebot zuzuordnen.',
  'Lokale Signale und Vertrauen fehlen. Konsistenter Name, Adresse, Telefon und Impressum stärken Auffindbarkeit und E-E-A-T.',
];

/** CTA für Standard-Ansprache */
export const DEFAULT_AKQUISE_KONTAKT_URL = 'https://soergel-design.de/kontakt';

/** Übersicht der drei WebApps (Zeiterfassung, Rechnung, KI-Posteingang) */
export const DEFAULT_SOFTWARE_URL = 'https://soergel-design.de/software';

/** Die drei Programme von soergel-design.de/software — fest, ohne KI, im Modal editierbar */
export const SOFTWARE_PUNKTE: [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt] = [
  {
    titel: 'Zeiterfassung — Stempeln aufs Projekt',
    empfehlung:
      'Handy-App für alle, die draußen arbeiten, Büroansicht für Berichte, Lohn und Rechnungen. Gestempelt wird auf das Projekt; Fotos, Material und Notizen hängen am selben Eintrag. Funktioniert auch im Funkloch.',
  },
  {
    titel: 'Auftrag & Rechnung — Belege entstehen auseinander',
    empfehlung:
      'Angebot, Lieferschein, Rechnung, Mahnung: jeder Beleg entsteht aus dem davor, keiner wird abgetippt. Die Nachkalkulation stellt Soll aus dem Angebot dem Ist aus der Zeiterfassung gegenüber — Zeile für Zeile.',
  },
  {
    titel: 'KI-Posteingang — lesen, sortieren, weitergeben',
    empfehlung:
      'Mehrere Postfächer in einem Eingang. Die KI liest Mail und PDF-Anhang, ordnet fest zu und zieht bei Rechnungen die Zahlen. Was in die Buchhaltung gehört, geht von dort weiter — freigegeben wird weiterhin von Menschen.',
  },
];

function punkteAlsStrings(
  punkte: [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt]
): [string, string, string] {
  return punkte.map(p => {
    const t = String(p.titel ?? '').trim();
    const e = String(p.empfehlung ?? '').trim();
    if (!t) return e;
    if (!e) return t;
    return `${t}\n\n${e}`;
  }) as [string, string, string];
}

/** Vorgefüllter Haupttext für die Standard-E-Mail (ohne KI); im Modal editierbar */
export const DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT = `Bei SØRGEL-design begleite ich Unternehmen wie Ihres, wenn es um greifbare digitale Lösungen geht: von einer klaren, schnellen Website über maßgeschneiderte WebApps und interne Tools (Abläufe, Daten, Schnittstellen) bis zu Automatisierungen, die im Alltag Zeit sparen.

Ergänzend kümmere ich mich um Media — etwa Foto und Video, Social-Media-Auftritt und Inhalte, die zu Ihrer Marke passen — sowie um Print: von der Geschäftsausstattung über Flyer bis zu Großformaten, damit Auftritt online und offline zusammenpasst.

Ich würde mich freuen, mit Ihnen zu prüfen, wo wir mit Digitalisierung und Branding den größten Mehrwert für Ihren Betrieb heben können — unverbindlich und auf Augenhöhe.`;

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
  const dotIdx = raw.search(/[.!?]/);
  if (dotIdx > 10 && dotIdx < raw.length - 10) {
    return {
      title: raw.slice(0, dotIdx + 1).trim(),
      body: raw.slice(dotIdx + 1).trim(),
    };
  }
  const words = raw.split(' ');
  let title = '';
  let i = 0;
  while (i < words.length && title.length < 60) { title += (title ? ' ' : '') + words[i++]; }
  return { title: title || raw, body: words.slice(i).join(' ') };
}

function paragraphsFromEsc(escapedPlain: string): string {
  const parts = escapedPlain.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const pStyle =
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3A3A3A;margin:0 0 16px 0;';
  return parts
    .map(p => `<p style="${pStyle}">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function buildSubject(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `Kurzanalyse ${domain || lead.name} — 3 konkrete Punkte`;
}

export function buildSubjectStandard(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `Kurze Vorstellung — Digital & Branding für ${domain || lead.name}`;
}

export function buildSubjectSeo(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `SEO-Kurzcheck ${domain || lead.name} — 3 Punkte für Google`;
}

export function buildSubjectSoftware(lead: { name: string; website: string }): string {
  const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return `Drei Programme für ${domain || lead.name} — Zeiterfassung, Rechnung & Posteingang`;
}

/** Startwerte für das E-Mail-Modal (Analyse oder Standard) */
export function buildInitialEmailVars(
  lead: Lead,
  terminUrl: string,
  mode: AkquiseEmailTemplateKind
): EmailVars {
  const analyse = lead.analyse;
  const websiteUrl = lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  if (mode === 'standard') {
    return {
      customerName: analyse?.ansprechpartner || 'Guten Tag',
      companyName: lead.name,
      websiteUrl,
      ctaUrl: DEFAULT_AKQUISE_KONTAKT_URL,
      templateKind: 'standard',
      standardLeistungstext: DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT,
      optimierungen: ['', '', ''] as [string, string, string],
      subject: buildSubjectStandard(lead),
    };
  }

  if (mode === 'software') {
    return {
      customerName: analyse?.ansprechpartner || 'Guten Tag',
      companyName: lead.name,
      websiteUrl,
      ctaUrl: DEFAULT_SOFTWARE_URL,
      templateKind: 'software',
      optimierungPunkte: SOFTWARE_PUNKTE,
      optimierungen: punkteAlsStrings(SOFTWARE_PUNKTE),
      subject: buildSubjectSoftware(lead),
    };
  }

  const isSeo = mode === 'seo';
  const rohPunkte = isSeo ? analyse?.seoOptimierungen : analyse?.optimierungen;
  const drei = normalizeOptimierungenListe(rohPunkte);
  const optsFromKi: [string, string, string] = drei.map(p => {
    const t = String(p.titel ?? '').trim();
    const e = String(p.empfehlung ?? '').trim();
    if (!t && !e) return '';
    if (!t) return e;
    if (!e) return t;
    return `${t}\n\n${e}`;
  }) as [string, string, string];

  const hatKiText = optsFromKi.some(s => String(s ?? '').trim().length > 0);
  const fallback = isSeo ? FALLBACK_SEO_OPT : FALLBACK_OPT;

  return {
    customerName: analyse?.ansprechpartner || 'Guten Tag',
    companyName: lead.name,
    websiteUrl,
    ctaUrl: terminUrl || DEFAULT_AKQUISE_KONTAKT_URL,
    templateKind: mode,
    optimierungPunkte: hatKiText ? drei : undefined,
    optimierungen: hatKiText ? optsFromKi : [...fallback],
    subject: isSeo ? buildSubjectSeo(lead) : buildSubject(lead),
  };
}

export function buildEmailHtml(vars: EmailVars): string {
  const isStandard = vars.templateKind === 'standard';
  const isSeo = vars.templateKind === 'seo';
  const isSoftware = vars.templateKind === 'software';
  const isPunkteVorlage = !isStandard;
  const leistungRaw = (vars.standardLeistungstext ?? DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT).trim();

  const fallback = isSeo ? FALLBACK_SEO_OPT : isSoftware ? punkteAlsStrings(SOFTWARE_PUNKTE) : FALLBACK_OPT;
  const opts = vars.optimierungen.length === 3
    ? vars.optimierungen
    : fallback;

  const parsed =
    isPunkteVorlage && vars.optimierungPunkte
      ? (vars.optimierungPunkte.map((p, i) => ({
          title: String(p.titel ?? '').trim() || `Empfehlung ${i + 1}`,
          body: String(p.empfehlung ?? '').trim(),
        })) as [
          { title: string; body: string },
          { title: string; body: string },
          { title: string; body: string },
        ])
      : (opts.map(o => splitOpt(o)) as [
          { title: string; body: string },
          { title: string; body: string },
          { title: string; body: string },
        ]);

  const preheader = vars.preheader
    ?? (isStandard
      ? `Digitale Lösungen, WebApps, Media & Print — gern gemeinsam mit ${vars.companyName}.`
      : isSeo
        ? `3 SEO-Punkte für ${vars.websiteUrl} — wie Google Sie findet. 15 Min. Gespräch, kostenlos.`
        : isSoftware
          ? `Zeiterfassung, Rechnung und KI-Posteingang — drei Programme, in denen dieselbe Zahl nur einmal erfasst wird.`
          : `3 konkrete Punkte auf ${vars.websiteUrl}, die Sie heute Kunden kosten — 15 Min. Gespräch, kostenlos.`);

  const headerBadge = isStandard ? 'Ansprache' : isSeo ? 'SEO-Kurzcheck' : isSoftware ? 'Software' : 'Kurzanalyse';
  const kicker = isStandard
    ? `Kennenlernen · ${esc(vars.companyName)}`
    : isSeo
      ? `SEO · ${esc(vars.companyName)}`
      : isSoftware
        ? `WebApps · ${esc(vars.companyName)}`
        : `Analyse · ${esc(vars.companyName)}`;
  const h1 = isStandard
    ? `Digitale Lösungen & <span style="color:#8A8178;">Branding</span><br>— gemeinsam denken wir weiter.`
    : isSeo
      ? `Bei Google <span style="color:#8A8178;">verschenken</span><br>Sie Sichtbarkeit.`
      : isSoftware
        ? `Dieselbe Zahl <span style="color:#8A8178;">nur einmal</span><br>erfassen.`
        : `Ihre Website <span style="color:#8A8178;">verschenkt</span><br>gerade Kunden.`;

  const hasWeb = !!vars.websiteUrl.trim();
  const intro = isStandard
    ? (hasWeb
      ? `Hallo ${esc(vars.customerName)},<br><br>ich schreibe Ihnen, weil ich auf ${esc(vars.companyName)} gestoßen bin und Ihre Präsenz unter <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> gesehen habe. Gern stelle ich mich kurz vor und sage, wie ich Sie bei digitalen Themen und einem stimmigen Markenauftritt unterstützen kann:`
      : `Hallo ${esc(vars.customerName)},<br><br>ich schreibe Ihnen, weil ich auf ${esc(vars.companyName)} gestoßen bin. Gern stelle ich mich kurz vor und sage, wie ich Sie bei digitalen Themen und einem stimmigen Markenauftritt unterstützen kann:`)
    : isSeo
      ? `Hallo ${esc(vars.customerName)},<br><br>ich habe mir <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> angesehen und einen kurzen SEO-Check gemacht. Drei Punkte bremsen Ihre Auffindbarkeit bei Google — oft lassen sie sich ohne großen Aufwand verbessern.`
      : isSoftware
        ? `Hallo ${esc(vars.customerName)},<br><br>ich schreibe Ihnen, weil ich auf ${esc(vars.companyName)} gestoßen bin${hasWeb ? ` und Ihre Präsenz unter <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> gesehen habe` : ''}. Neben Websites baue ich drei Programme für den laufenden Betrieb — entstanden im echten Einsatz, nicht am Reißbrett. Einzeln einsetzbar, zusammen ein Ablauf, in dem dieselbe Zahl nur einmal erfasst wird.`
        : `Hallo ${esc(vars.customerName)},<br><br>ich habe mir <a href="https://${esc(vars.websiteUrl)}" style="color:#0A0A0A;text-decoration:underline;text-decoration-color:#C94A1C;text-underline-offset:3px;">${esc(vars.websiteUrl)}</a> angesehen. Drei Punkte kosten Sie messbar Anfragen — lassen sich in wenigen Wochen lösen.`;

  const punkteSectionLabel = isSeo ? 'SEO-Kurzcheck' : isSoftware ? 'Drei Programme' : 'Optimierungspotenziale';

  const mainBlock = isStandard
    ? `
        <tr>
          <td style="background:#FFFFFF;padding:40px 48px 16px 48px;" class="px">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;color:#8A8178;text-transform:uppercase;padding-bottom:14px;">Leistungen & Zusammenarbeit</div>
            ${paragraphsFromEsc(esc(leistungRaw))}
          </td>
        </tr>`
    : `
        <tr>
          <td style="background:#FFFFFF;padding:40px 48px 16px 48px;" class="px">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;color:#8A8178;text-transform:uppercase;padding-bottom:20px;">${punkteSectionLabel}</div>
            ${opt(1, parsed[0].title, parsed[0].body)}
            ${opt(2, parsed[1].title, parsed[1].body)}
            ${opt(3, parsed[2].title, parsed[2].body)}
          </td>
        </tr>`;

  const accentTitle = isStandard || isSoftware ? 'Nächster Schritt' : 'Mein Angebot';
  const accentBody = isStandard
    ? `Wenn das für Sie interessant klingt, freue ich mich über eine kurze Rückmeldung — am einfachsten über das <span style="color:#BFB8AE;">Kontaktformular</span> auf meiner Seite. Von dort aus vereinbaren wir gern ein unverbindliches Gespräch und schauen, <span style="color:#BFB8AE;">wie wir gemeinsam an Ihren digitalen Lösungen oder am Branding weiterarbeiten können.</span>`
    : isSeo
      ? `15 Minuten am Telefon. Ich gehe die drei SEO-Punkte an Ihrer Seite durch — <span style="color:#BFB8AE;">kein Verkaufsgespräch, kein Haken.</span>`
      : isSoftware
        ? `Die Programme werden im laufenden Betrieb angepasst, nicht als Standardpaket verkauft. 15 Minuten am Telefon reichen, um zu sehen, <span style="color:#BFB8AE;">ob Zeiterfassung, Rechnung oder Posteingang zu Ihrem Ablauf passen.</span>`
        : `15 Minuten am Telefon. Ich zeige Ihnen die drei Punkte konkret an Ihrer Seite — <span style="color:#BFB8AE;">kein Verkaufsgespräch, kein Haken.</span>`;

  const ctaHref = esc(vars.ctaUrl);
  const ctaLabel = isStandard
    ? 'Zum Kontaktformular'
    : isSoftware
      ? 'Die drei Programme ansehen&nbsp;&nbsp;→'
      : 'Kostenloses 15-Min-Gespräch buchen&nbsp;&nbsp;→';
  const ctaSub = isStandard
    ? ''
    : `<td style="padding-left:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#8A8178;">
                  oder einfach auf diese Mail antworten.
                </td>`;

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
                  ${headerBadge}
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
                  <span style="display:inline-block;width:24px;height:1px;background:#C94A1C;vertical-align:middle;margin-right:10px;"></span>${kicker}
                </td>
              </tr>
              <tr>
                <td class="h1" style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.1;color:#0A0A0A;font-weight:400;letter-spacing:-0.01em;padding-bottom:20px;">
                  ${h1}
                </td>
              </tr>
              <tr>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#3A3A3A;padding-bottom:28px;">
                  ${intro}
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

        ${mainBlock}

        <!-- Accent -->
        <tr>
          <td style="background:#FFFFFF;padding:16px 48px 40px 48px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;border-radius:14px;">
              <tr>
                <td style="padding:28px 32px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#C94A1C;text-transform:uppercase;padding-bottom:10px;">${accentTitle}</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#FFFFFF;font-weight:400;">
                    ${accentBody}
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
                  <a href="${ctaHref}" class="cta-btn" style="display:inline-block;padding:16px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:-0.005em;">
                    ${ctaLabel}
                  </a>
                </td>
                ${ctaSub}
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
              <span style="color:#8A8178;">Websites · Webapps · Media · Print · Automationen</span>
            </div>
          </td>
        </tr>

      </table>

      <!-- Footer -->
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td style="padding:24px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9A928A;" class="px" align="center">
            Sie erhalten diese Mail einmalig im Rahmen einer geschäftlichen Kontaktaufnahme. Kein Newsletter. Keine Weitergabe.<br>
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

export function buildPlainText(vars: EmailVars): string {
  if (vars.templateKind === 'standard') {
    const leistung = (vars.standardLeistungstext ?? DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT).trim();
    const hasWeb = !!vars.websiteUrl.trim();
    const einleitung = hasWeb
      ? `ich schreibe Ihnen, weil ich auf ${vars.companyName} gestoßen bin und Ihre Präsenz unter ${vars.websiteUrl} gesehen habe. Gern stelle ich mich kurz vor:`
      : `ich schreibe Ihnen, weil ich auf ${vars.companyName} gestoßen bin. Gern stelle ich mich kurz vor:`;
    return `Hallo ${vars.customerName},

${einleitung}

${leistung}

Wenn das für Sie interessant klingt, freue ich mich über eine kurze Rückmeldung — z. B. über mein Kontaktformular:
${vars.ctaUrl || DEFAULT_AKQUISE_KONTAKT_URL}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
  }

  if (vars.templateKind === 'software') {
    const hasWeb = !!vars.websiteUrl.trim();
    const einleitung = hasWeb
      ? `ich schreibe Ihnen, weil ich auf ${vars.companyName} gestoßen bin und Ihre Präsenz unter ${vars.websiteUrl} gesehen habe. Neben Websites baue ich drei Programme für den laufenden Betrieb — entstanden im echten Einsatz, nicht am Reißbrett. Einzeln einsetzbar, zusammen ein Ablauf, in dem dieselbe Zahl nur einmal erfasst wird:`
      : `ich schreibe Ihnen, weil ich auf ${vars.companyName} gestoßen bin. Neben Websites baue ich drei Programme für den laufenden Betrieb — entstanden im echten Einsatz, nicht am Reißbrett. Einzeln einsetzbar, zusammen ein Ablauf, in dem dieselbe Zahl nur einmal erfasst wird:`;
    const blocks = vars.optimierungPunkte
      ? vars.optimierungPunkte.map((p, i) => {
          const t = String(p.titel ?? '').trim();
          const e = String(p.empfehlung ?? '').trim();
          const head = t || `Programm ${i + 1}`;
          const num = String(i + 1).padStart(2, '0');
          return `${num} · ${head}${e ? `\n${e}` : ''}`;
        })
      : (vars.optimierungen.length === 3 ? vars.optimierungen : punkteAlsStrings(SOFTWARE_PUNKTE))
          .map((s, i) => `${String(i + 1).padStart(2, '0')} · ${s}`);
    return `Hallo ${vars.customerName},

${einleitung}

${blocks.join('\n\n')}

Die Programme werden im laufenden Betrieb angepasst, nicht als Standardpaket verkauft. 15 Minuten am Telefon reichen, um zu sehen, ob Zeiterfassung, Rechnung oder Posteingang zu Ihrem Ablauf passen.

Überblick: ${vars.ctaUrl || DEFAULT_SOFTWARE_URL}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
  }

  const opts = vars.optimierungen.length === 3 ? vars.optimierungen : (vars.templateKind === 'seo' ? FALLBACK_SEO_OPT : FALLBACK_OPT);
  const isSeo = vars.templateKind === 'seo';

  if (vars.optimierungPunkte && (vars.templateKind === 'analyse' || vars.templateKind === 'seo')) {
    const blocks = vars.optimierungPunkte.map((p, i) => {
      const t = String(p.titel ?? '').trim();
      const e = String(p.empfehlung ?? '').trim();
      const head = t || `Punkt ${i + 1}`;
      const num = String(i + 1).padStart(2, '0');
      return `${num} · ${head}${e ? `\n${e}` : ''}`;
    });
    const einleitung = isSeo
      ? `ich habe mir ${vars.websiteUrl} angesehen und einen kurzen SEO-Check gemacht. Drei Punkte bremsen Ihre Auffindbarkeit bei Google:`
      : `ich habe mir ${vars.websiteUrl} angesehen. Drei Punkte kosten Sie messbar Anfragen:`;
    const angebot = isSeo
      ? 'Mein Angebot: 15 Minuten am Telefon. Ich gehe die drei SEO-Punkte an Ihrer Seite durch — kein Verkaufsgespräch, kein Haken.'
      : 'Mein Angebot: 15 Minuten am Telefon. Ich zeige Ihnen die drei Punkte konkret an Ihrer Seite — kein Verkaufsgespräch, kein Haken.';
    return `Hallo ${vars.customerName},

${einleitung}

${blocks.join('\n\n')}

${angebot}

Termin buchen: ${vars.ctaUrl}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
  }

  const einleitung = isSeo
    ? `ich habe mir ${vars.websiteUrl} angesehen und einen kurzen SEO-Check gemacht. Drei Punkte bremsen Ihre Auffindbarkeit bei Google:`
    : `ich habe mir ${vars.websiteUrl} angesehen. Drei Punkte kosten Sie messbar Anfragen:`;
  const angebot = isSeo
    ? 'Mein Angebot: 15 Minuten am Telefon. Ich gehe die drei SEO-Punkte an Ihrer Seite durch — kein Verkaufsgespräch, kein Haken.'
    : 'Mein Angebot: 15 Minuten am Telefon. Ich zeige Ihnen die drei Punkte konkret an Ihrer Seite — kein Verkaufsgespräch, kein Haken.';

  return `Hallo ${vars.customerName},

${einleitung}

01 · ${opts[0]}

02 · ${opts[1]}

03 · ${opts[2]}

${angebot}

Termin buchen: ${vars.ctaUrl}

Viele Grüße
Christof Sörgel
SØRGEL-design · www.soergel-design.de

---
Sie erhalten diese Mail einmalig. Nicht mehr kontaktieren: hallo@soergel-design.de`;
}
