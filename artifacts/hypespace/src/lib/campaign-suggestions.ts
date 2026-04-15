export type SuggestionAction =
  | "personalize"
  | "countdown"
  | "speaker-add"
  | "topic-add"
  | "speaker-tip"
  | "topic-tip";

export interface SuggestionMeta {
  action: SuggestionAction;
  requiresInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

const COUNTDOWN_BLOCK = `
          <!-- COUNTDOWN BANNER -->
          <tr>
            <td style="padding:0 40px 24px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0533 0%,#6d28d9 100%);border-radius:16px;">
                <tr>
                  <td style="text-align:center;padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.65);">&#9201; Time-Sensitive</p>
                    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Spots Are Filling Fast</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">Reserve your seat now before it&#39;s too late</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

function buildSpeakerBlock(name: string): string {
  return `
          <!-- SPEAKER BLOCK -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe;border-radius:14px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <span style="display:inline-block;background:#ede9fe;color:#6d28d9;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">&#127908; Featured Speaker</span>
                    <p style="margin:0;font-size:17px;font-weight:700;color:#1a0533;line-height:1.4;">${name}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildTopicBlock(name: string): string {
  return `
          <!-- TOPIC BLOCK -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fed7aa;border-radius:14px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">&#128203; Session Topic</span>
                    <p style="margin:0;font-size:17px;font-weight:700;color:#1a0533;line-height:1.4;">${name}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function applySuggestionToHtml(
  html: string,
  action: SuggestionAction,
  input?: string,
): { html: string; applied: boolean; message: string } {
  switch (action) {
    case "personalize": {
      if (!html.includes("Hi there,") && !html.includes("Hi {{first_name}},")) {
        return { html, applied: false, message: "Could not find greeting to personalize — try it in the HTML editor directly." };
      }
      if (html.includes("Hi {{first_name}},")) {
        return { html, applied: false, message: "Already personalized with {{first_name}}." };
      }
      const updated = html.replace(/Hi there,/g, "Hi {{first_name}},");
      return { html: updated, applied: true, message: "Added {{first_name}} merge tag to greeting." };
    }

    case "countdown": {
      if (html.includes("COUNTDOWN BANNER")) {
        return { html, applied: false, message: "Countdown banner is already in the email." };
      }
      const CTA_ANCHOR = "<!-- CTA BUTTON -->";
      if (!html.includes(CTA_ANCHOR)) {
        return { html, applied: false, message: "Could not locate the CTA section — add it manually in the HTML editor." };
      }
      const updated = html.replace(CTA_ANCHOR, `${COUNTDOWN_BLOCK}\n          ${CTA_ANCHOR}`);
      return { html: updated, applied: true, message: "Countdown urgency banner added above the CTA button." };
    }

    case "speaker-add": {
      if (!input?.trim()) {
        return { html, applied: false, message: "Speaker name is required." };
      }
      if (html.includes("SPEAKER BLOCK")) {
        return { html, applied: false, message: "Speaker block is already in the email." };
      }
      const CTA_ANCHOR = "<!-- CTA BUTTON -->";
      if (!html.includes(CTA_ANCHOR)) {
        return { html, applied: false, message: "Could not locate the CTA section — add it manually in the HTML editor." };
      }
      const block = buildSpeakerBlock(input.trim());
      const updated = html.replace(CTA_ANCHOR, `${block}\n          ${CTA_ANCHOR}`);
      return { html: updated, applied: true, message: `Featured speaker "${input.trim()}" added to the email.` };
    }

    case "topic-add": {
      if (!input?.trim()) {
        return { html, applied: false, message: "Topic name is required." };
      }
      if (html.includes("TOPIC BLOCK")) {
        return { html, applied: false, message: "Topic block is already in the email." };
      }
      const CTA_ANCHOR = "<!-- CTA BUTTON -->";
      if (!html.includes(CTA_ANCHOR)) {
        return { html, applied: false, message: "Could not locate the CTA section — add it manually in the HTML editor." };
      }
      const block = buildTopicBlock(input.trim());
      const updated = html.replace(CTA_ANCHOR, `${block}\n          ${CTA_ANCHOR}`);
      return { html: updated, applied: true, message: `Session topic "${input.trim()}" added to the email.` };
    }

    case "speaker-tip":
      return { html, applied: false, message: "Speaker is already highlighted in the email. Consider adding a short bio in the Additional Context." };

    case "topic-tip":
      return { html, applied: false, message: "Topic is already highlighted in the email. Consider adding bullet-point takeaways." };

    default:
      return { html, applied: false, message: "Unknown suggestion." };
  }
}

export function getSuggestionMeta(suggestionText: string): SuggestionMeta {
  const t = suggestionText.toLowerCase();

  if (t.includes("personalize") || t.includes("first_name") || t.includes("merge tag")) {
    return { action: "personalize" };
  }
  if (t.includes("countdown")) {
    return { action: "countdown" };
  }
  if (t.includes("speaker") && (t.includes("add '") || t.includes("add a"))) {
    return {
      action: "speaker-add",
      requiresInput: true,
      inputLabel: "Speaker Name",
      inputPlaceholder: "e.g. Jane Smith",
    };
  }
  if (t.includes("topic") && (t.includes("add '") || t.includes("add a"))) {
    return {
      action: "topic-add",
      requiresInput: true,
      inputLabel: "Topic Name",
      inputPlaceholder: "e.g. The Future of AI",
    };
  }
  if (t.includes("speaker")) {
    return { action: "speaker-tip" };
  }
  if (t.includes("topic")) {
    return { action: "topic-tip" };
  }
  return { action: "personalize" };
}

export const DEFAULT_SUGGESTIONS = [
  "Personalize with {{first_name}} merge tags to increase open rates by up to 26%",
  "Add a countdown banner above the CTA for urgency",
  "Add 'Speaker: [Name]' in Additional Context to get a featured speaker section",
  "Add 'Topic: [Subject]' in Additional Context to highlight the session topic",
];
