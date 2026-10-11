import type { Region } from "@complianceos/shared";

const W = 800;
const H = 1100;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function lines(text: string, x: number, y: number, max: number, size = 13, weight = 400): string {
  const words = text.split(" ");
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { rows.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) rows.push(cur);
  return rows.map((r, i) => `<text x="${x}" y="${y + i * (size + 6)}" font-size="${size}" font-weight="${weight}">${esc(r)}</text>`).join("");
}

const CLAUSES = {
  c1: "3.1 A regulated entity shall report every cyber security incident to the Regulator within 6 hours of detection through the designated portal.",
  c2: "3.2 The Board shall approve the Cyber Crisis Management Plan annually and review its effectiveness through a documented tabletop exercise.",
  c3: "3.3 Audit logs of all privileged access shall be retained for a period of not less than 180 days within India.",
  c4: "3.4 Non-compliance with para 3.1 may attract monetary penalties as set out in Table 1 below.",
  c5: "3.5 Entities shall notify affected customers without undue delay where personal data is compromised.",
};

// A synthetic "scanned" circular page, drawn as an SVG data URL.
function buildPage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Georgia, serif" fill="#2b2b2b">
<defs><filter id="n"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.05 0"/></filter></defs>
<rect width="${W}" height="${H}" fill="#f7f4ec"/><rect width="${W}" height="${H}" filter="url(#n)"/>
${lines("RESERVE REGULATORY AUTHORITY", 50, 62, 40, 22, 700)}
${lines("Circular No. RRA/2024/CS-17  |  Cyber Security Framework", 50, 92, 70, 13)}
<circle cx="685" cy="75" r="34" fill="none" stroke="#7a2a2a" stroke-width="3"/><circle cx="685" cy="75" r="26" fill="none" stroke="#7a2a2a" stroke-width="1.5"/>
<text x="685" y="80" text-anchor="middle" font-size="12" fill="#7a2a2a" font-weight="700">RRA</text>
<line x1="50" y1="118" x2="750" y2="118" stroke="#555" stroke-width="1.5"/>
${lines(CLAUSES.c1, 55, 150, 88)}${lines(CLAUSES.c2, 55, 240, 88)}${lines(CLAUSES.c3, 55, 330, 88)}
${lines(CLAUSES.c4, 55, 420, 88)}
<g font-size="12">
<rect x="50" y="470" width="700" height="150" fill="none" stroke="#444"/>
<rect x="50" y="470" width="700" height="30" fill="#e6e0d0" stroke="#444"/>
<line x1="330" y1="470" x2="330" y2="620" stroke="#444"/><line x1="560" y1="470" x2="560" y2="620" stroke="#444"/>
<text x="62" y="490" font-weight="700">Nature of default</text><text x="342" y="490" font-weight="700">Penalty (INR)</text><text x="572" y="490" font-weight="700">Repeat default</text>
<line x1="50" y1="530" x2="750" y2="530" stroke="#444"/><line x1="50" y1="560" x2="750" y2="560" stroke="#444"/><line x1="50" y1="590" x2="750" y2="590" stroke="#444"/>
<text x="62" y="520">Delay in incident report</text><text x="342" y="520">1,00,000 per day</text><text x="572" y="520">2x base penalty</text>
<text x="62" y="550">Missing audit logs</text><text x="342" y="550">5,00,000</text><text x="572" y="550">10,00,000</text>
<text x="62" y="580">No Board-approved CCMP</text><text x="342" y="580">10,00,000</text><text x="572" y="580">25,00,000</text>
<text x="62" y="610">Non-disclosure to customers</text><text x="342" y="610">2,00,000 per customer</text><text x="572" y="610">Licence review</text>
</g>
<text x="50" y="642" font-size="11" font-style="italic">Table 1 - Indicative penalty schedule</text>
<g font-size="12" fill="none" stroke="#333" stroke-width="1.5">
<rect x="60" y="690" width="140" height="50" fill="#ece7d8"/><rect x="235" y="690" width="140" height="50" fill="#ece7d8"/>
<rect x="410" y="690" width="140" height="50" fill="#ece7d8"/><rect x="585" y="690" width="140" height="50" fill="#ece7d8"/>
<path d="M200 715H235M375 715H410M550 715H585" marker-end="url(#a)"/>
<path d="M200 715l-6-4v8z M375 715l-6-4v8z M550 715l-6-4v8z" fill="#333"/>
<path d="M585 715 L 585 715" />
</g>
<g font-size="12" fill="#2b2b2b" text-anchor="middle"><text x="130" y="720">Detect incident</text><text x="305" y="720">Triage &amp; classify</text><text x="480" y="720">Report to RRA (6h)</text><text x="655" y="720">Root cause review</text></g>
<text x="50" y="770" font-size="11" font-style="italic">Figure 1 - Incident escalation flow</text>
${lines(CLAUSES.c5, 55, 830, 88)}
<text x="50" y="1040" font-size="10" fill="#777">Page 1 of 1 - scanned copy - RRA/2024/CS-17</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const DEMO_PAGE_IMAGE = buildPage();

const rg = (x: number, y: number, w: number, h: number): Region => ({ x: x / W, y: y / H, w: w / W, h: h / H });

/** Demo grounding for an obligation on ObligationDetail. */
export const DEMO_GROUNDING = {
  obligationId: "demo-obl-1",
  sourceFileId: "demo-file-1",
  sourcePage: 1,
  sourceRegion: rg(50, 130, 700, 70),
};
