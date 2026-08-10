// scripts/generate-docs-pdf.mjs — pure Node.js PDF 1.4 writer, no dependencies
// Produces docs/diagrams/software-documentation-types.pdf (2-page A4 landscape)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, '..', 'docs', 'diagrams', 'software-documentation-types.pdf');

const PW = 841.89, PH = 595.28; // A4 landscape (points)

// ── helpers ────────────────────────────────────────────────────────────────

const f = (n) => n.toFixed(3);

// Escape for PDF string literal (latin1)
const ps = (s) => String(s)
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  .replace(/—|–/g, '\x97')
  .replace(/·/g, '\xB7')
  .replace(/•/g, '\x95')
  .replace(/[^\x00-\xFF]/g, '?');

// Coord transform: SVG viewBox -> PDF page (flips Y)
function xform(svgW, svgH, margin = 18) {
  const uw = PW - 2 * margin, uh = PH - 2 * margin;
  const s = Math.min(uw / svgW, uh / svgH);
  const ox = margin + (uw - svgW * s) / 2;
  const ot = margin + (uh - svgH * s) / 2; // top margin
  return { s, x: (vx) => ox + vx * s, y: (vy) => PH - ot - vy * s };
}

// Rounded rect path string
function rrp(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const k = 0.5523 * r;
  return `${f(x+r)} ${f(y)} m ${f(x+w-r)} ${f(y)} l `
    + `${f(x+w-r+k)} ${f(y)} ${f(x+w)} ${f(y+r-k)} ${f(x+w)} ${f(y+r)} c `
    + `${f(x+w)} ${f(y+h-r)} l `
    + `${f(x+w)} ${f(y+h-r+k)} ${f(x+w-r+k)} ${f(y+h)} ${f(x+w-r)} ${f(y+h)} c `
    + `${f(x+r)} ${f(y+h)} l `
    + `${f(x+r-k)} ${f(y+h)} ${f(x)} ${f(y+h-r+k)} ${f(x)} ${f(y+h-r)} c `
    + `${f(x)} ${f(y+r)} l `
    + `${f(x)} ${f(y+r-k)} ${f(x+r-k)} ${f(y)} ${f(x+r)} ${f(y)} c h`;
}

const path = (x, y, w, h, rx) =>
  rx > 0 ? rrp(x, y, w, h, rx) : `${f(x)} ${f(y)} ${f(w)} ${f(h)} re`;

const rFill = (x, y, w, h, fc, sc, lw = 1.2, rx = 0) =>
  `q ${lw} w ${fc} rg ${sc} RG ${path(x, y, w, h, rx)} B Q`;

const rStroke = (x, y, w, h, sc, lw = 1.2, rx = 0, dash = '') =>
  `q ${lw} w ${sc} RG [${dash}] 0 d ${path(x, y, w, h, rx)} S Q`;

const tx = (text, x, y, sz, fc, bold = false) =>
  `q ${fc} rg BT ${bold ? '/Hb' : '/Hv'} ${sz} Tf ${f(x)} ${f(y)} Td (${ps(text)}) Tj ET Q`;

const txc = (text, cx, y, sz, fc, bold = false) =>
  tx(text, cx - text.length * sz * (bold ? 0.51 : 0.46) / 2, y, sz, fc, bold);

function arw(x1, y1, x2, y2, sc, lw = 1.2) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, s = 5;
  const ax = x2 - ux * s, ay = y2 - uy * s;
  return `q ${lw} w ${sc} RG ${sc} rg `
    + `${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S `
    + `${f(x2)} ${f(y2)} m ${f(ax+nx*s*0.45)} ${f(ay+ny*s*0.45)} l `
    + `${f(ax-nx*s*0.45)} ${f(ay-ny*s*0.45)} l f Q`;
}

// Color palette
const C = {
  navy: '0.044 0.102 0.180', dk: '0.055 0.126 0.251',
  bdr:  '0.227 0.486 0.647', teal: '0.373 0.812 0.937',
  lb:   '0.722 0.831 0.894', wh: '0.910 0.941 0.965',
  med:  '0.357 0.561 0.658', mid: '0.102 0.227 0.361',
  d2:   '0.039 0.118 0.208', b2: '0.165 0.376 0.502',
  ftr:  '0.165 0.290 0.391',
};

// ── Page 1: Hierarchy diagram (SVG 1240 × 740) ────────────────────────────
function page1() {
  const { s, x: sx, y: sy } = xform(1240, 740);
  const c = [];

  c.push(rFill(0, 0, PW, PH, C.navy, C.navy, 0));
  c.push(txc('SOFTWARE DOCUMENTATION TYPES', PW / 2, sy(42) - 3, 10, '1 1 1', true));

  // Project documentation
  c.push(rFill(sx(460), sy(106), 240*s, 48*s, C.dk, C.bdr, 1.2, 5*s));
  c.push(txc('Project documentation', sx(580), sy(87) - 3, 8, C.wh));
  c.push(arw(sx(540), sy(106), sx(300), sy(155), C.med));
  c.push(arw(sx(700), sy(106), sx(990), sy(155), C.med));

  // Product documentation
  c.push(rFill(sx(170), sy(203), 260*s, 48*s, C.dk, C.bdr, 1.2, 5*s));
  c.push(txc('Product documentation', sx(300), sy(184) - 3, 8, C.wh));
  c.push(arw(sx(230), sy(203), sx(170), sy(268), C.med));
  c.push(arw(sx(370), sy(203), sx(590), sy(268), C.med));

  // Process documentation container (stroke-only border)
  c.push(rStroke(sx(855), sy(575), 340*s, 420*s, C.bdr, 1.2, 8*s));
  c.push(rFill(sx(890), sy(189), 270*s, 34*s, C.dk, C.dk, 0, 4*s));
  c.push(txc('Process documentation', sx(1025), sy(178) - 3, 8, C.wh));
  ['Plans','Estimates','Schedules','Reports and metrics','Working papers','Standards']
    .forEach((t, i) => {
      const vy = [220,252,284,316,348,380][i];
      c.push(tx('>', sx(882), sy(vy)-3, 7.5, C.teal, true));
      c.push(tx(t,  sx(900), sy(vy)-3, 7,   C.lb));
    });

  // System documentation container (stroke-only border)
  c.push(rStroke(sx(30), sy(708), 320*s, 440*s, C.bdr, 1.2, 8*s));
  c.push(rFill(sx(68), sy(302), 245*s, 34*s, C.dk, C.dk, 0, 4*s));
  c.push(txc('System documentation', sx(190), sy(291) - 3, 8, C.wh));
  ['Product requirement document','Design and architecture','Agile product roadmaps',
   'Source code document','User experience design','Testing documents','Help and maintenance']
    .forEach((t, i) => {
      const vy = [342,377,412,447,482,535,570][i];
      c.push(tx('>', sx(62), sy(vy)-3, 7.5, C.teal, true));
      c.push(tx(t,  sx(80), sy(vy)-3, 7,   C.lb));
    });

  // User documentation
  c.push(rFill(sx(465), sy(316), 260*s, 48*s, C.dk, C.bdr, 1.2, 5*s));
  c.push(txc('User documentation', sx(595), sy(297) - 3, 8, C.wh));
  c.push(arw(sx(548), sy(316), sx(495), sy(385), C.med));
  c.push(arw(sx(642), sy(316), sx(705), sy(385), C.med));

  // End-users box
  c.push(rFill(sx(375), sy(443), 220*s, 58*s, C.dk, C.bdr, 1.2, 5*s));
  c.push(txc('End-users', sx(485), sy(407) - 3, 7.5, C.wh));
  c.push(txc('documentation', sx(485), sy(426) - 3, 7.5, C.wh));

  // System admin box
  c.push(rFill(sx(625), sy(443), 220*s, 58*s, C.dk, C.bdr, 1.2, 5*s));
  c.push(txc('System admin', sx(735), sy(407) - 3, 7.5, C.wh));
  c.push(txc('documentation', sx(735), sy(426) - 3, 7.5, C.wh));

  c.push(tx('copilot-governance  software-documentation-types.svg', sx(700), sy(732)-2, 6, C.ftr));
  return c.join('\n');
}

// ── Page 2: SDLC flow (SVG 1240 × 620) ────────────────────────────────────
function page2() {
  const { s, x: sx, y: sy } = xform(1240, 620);
  const c = [];

  c.push(rFill(0, 0, PW, PH, C.navy, C.navy, 0));
  c.push(txc('SOFTWARE DOCUMENTATION \x97 SDLC FLOW', PW / 2, sy(38) - 3, 10, '1 1 1', true));
  c.push(txc('Which documentation is produced at each phase of the software development lifecycle',
             PW / 2, sy(58) - 3, 7, C.med));

  // Phase headers + arrows
  const phX = [20, 215, 410, 605, 800, 995];
  const phW = [175, 175, 175, 175, 175, 230];
  ['PLAN','DESIGN','DEVELOP','TEST','DEPLOY','MONITOR & MAINTAIN'].forEach((n, i) => {
    c.push(rFill(sx(phX[i]), sy(110), phW[i]*s, 36*s, C.mid, C.bdr, 1.4, 5*s));
    c.push(txc(n, sx(phX[i]+phW[i]/2), sy(97)-3, 7, C.teal, true));
    if (i < 5) c.push(arw(sx(phX[i]+phW[i]+2), sy(92), sx(phX[i+1]-2), sy(92), C.bdr, 1.4));
  });

  // Process banner (dashed outline)
  c.push(rStroke(sx(20), sy(190), 1205*s, 62*s, '0.165 0.357 0.478', 1.2, 6*s, '5 3'));
  c.push(tx('Process documentation (spans entire lifecycle)', sx(30), sy(148)-3, 6.5, '0.290 0.541 0.667'));
  c.push(tx('Plans  \xB7  Estimates  \xB7  Schedules  \xB7  Status Reports  \xB7  Working Papers  \xB7  Standards',
            sx(30), sy(168)-3, 7, '0.478 0.722 0.831'));

  // Card rows
  const row1 = [
    [20,175,'Product Requirement Doc','Risk management plan'],
    [215,175,'Architecture & Design','System diagrams / UX wireframes'],
    [410,175,'Source Code Docs','API specs / ADRs / Changelog'],
    [605,175,'Test Plans & Cases','Traceability / Defect reports'],
    [800,175,'Runbooks','Deployment guide / Release notes'],
    [995,230,'Incident Playbooks','On-call guide / Post-mortems'],
  ];
  const row2 = [
    [20,175,'Agile Product Roadmap','Capacity plan / Comms plan'],
    [215,175,'UX Design System','Data model (ERD) / Design reviews'],
    [410,175,'Contribution Guide','Module READMEs / Design spikes'],
    [605,175,'Test Execution Report','Performance / Security reports'],
    [800,175,'Installation Guide','Config reference / Sec hardening'],
    [995,230,'Dependency Inventory','Security posture / EOL plan'],
  ];
  for (const [vx, vw, title, sub] of row1) {
    c.push(rFill(sx(vx), sy(260), vw*s, 55*s, C.d2, C.b2, 1.1, 4*s));
    c.push(txc(title, sx(vx+vw/2), sy(222)-3, 6.5, C.teal, true));
    c.push(txc(sub,   sx(vx+vw/2), sy(248)-3, 6,   C.lb));
  }
  for (const [vx, vw, title, sub] of row2) {
    c.push(rFill(sx(vx), sy(333), vw*s, 55*s, C.d2, C.b2, 1.1, 4*s));
    c.push(txc(title, sx(vx+vw/2), sy(295)-3, 6.5, C.teal, true));
    c.push(txc(sub,   sx(vx+vw/2), sy(315)-3, 6,   C.lb));
  }

  // User documentation band
  c.push(rFill(sx(410), sy(406), 565*s, 55*s, C.d2, C.b2, 1.2, 5*s));
  c.push(txc('User documentation \x97 written during Develop, finalised at Deploy',
             sx(693), sy(368)-3, 6, '0.290 0.604 0.749'));
  c.push(txc('End-user docs  \xB7  Getting started  \xB7  User manual  \xB7  FAQ  \xB7  Tutorials',
             sx(498+87), sy(391)-3, 6.5, C.teal));
  c.push(txc('Sys admin docs  \xB7  Upgrade guide  \xB7  Audit & compliance',
             sx(888), sy(391)-3, 6.5, C.teal));

  // Row 4 bands
  c.push(rFill(sx(215), sy(472), 370*s, 48*s, C.d2, C.b2, 1.2, 5*s));
  c.push(txc('Accessibility & Usability', sx(400), sy(441)-3, 6.5, C.teal, true));
  c.push(txc('Usability test reports  \xB7  WCAG audit  \xB7  Accessibility statement',
             sx(400), sy(459)-3, 6, C.lb));

  c.push(rFill(sx(800), sy(472), 425*s, 48*s, C.d2, C.b2, 1.2, 5*s));
  c.push(txc('Backup & Recovery  \xB7  Integration Guides', sx(1013), sy(441)-3, 6.5, C.teal, true));
  c.push(txc('Backup schedule  \xB7  Restore  \xB7  RTO/RPO  \xB7  Third-party integrations',
             sx(1013), sy(459)-3, 6, C.lb));

  c.push(tx('copilot-governance  software-documentation-flow.svg', sx(800), sy(612)-2, 6, C.ftr));
  return c.join('\n');
}

// ── PDF assembly ───────────────────────────────────────────────────────────
const segs = [];
let pos = 0;
const emit = (s) => { segs.push(s); pos += s.length; };

const offs = {};
const obj = (id, body) => { offs[id] = pos; emit(`${id} 0 obj\n${body}\nendobj\n`); };

emit('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

obj(1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
obj(2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

const cs1 = page1(), cs2 = page2();
obj(3, `<< /Length ${cs1.length} >>\nstream\n${cs1}\nendstream`);
obj(4, `<< /Length ${cs2.length} >>\nstream\n${cs2}\nendstream`);

obj(5, '<< /Type /Pages /Kids [6 0 R 7 0 R] /Count 2 >>');
const res = '<< /Font << /Hv 1 0 R /Hb 2 0 R >> >>';
obj(6, `<< /Type /Page /Parent 5 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents 3 0 R /Resources ${res} >>`);
obj(7, `<< /Type /Page /Parent 5 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents 4 0 R /Resources ${res} >>`);
obj(8, '<< /Type /Catalog /Pages 5 0 R >>');

const xrefStart = pos;
emit('xref\n0 9\n0000000000 65535 f \n');
for (let i = 1; i <= 8; i++) emit(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
emit(`trailer\n<< /Size 9 /Root 8 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

writeFileSync(OUT, segs.join(''), 'latin1');
console.log('Written:', OUT);
