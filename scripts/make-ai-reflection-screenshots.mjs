import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const outDir = path.resolve('AI reflections');

const promptItems = [
  {
    title: 'Initial Build Prompt',
    body:
      'Build a full-stack centralized Issue Tracking Platform from the assignment directions, with complaints, admin assignment, resolution tracking, and transparency.'
  },
  {
    title: 'UI Fix Prompt',
    body: 'Logout button does not have a visible label in the admin section.'
  },
  {
    title: 'Feature Improvement Prompt',
    body: 'Allow an opened issue to be edited any number of times, and fix My Issues overlapping with the issue detail/input section.'
  },
  {
    title: 'API Testing Prompt',
    body: 'Test the API responses, validate response bodies and status codes, and generate test cases for the same.'
  },
  {
    title: 'UX Feedback Prompt',
    body: 'Button clicks do not feel like data has been submitted. Improve the look and feel.'
  },
  {
    title: 'Backend Hardening Prompt',
    body: 'Implement rate limiting for requests.'
  },
  {
    title: 'API Documentation Prompt',
    body: 'Provide an OpenAPI specification for the implemented APIs.'
  }
];

const reflectionSections = [
  {
    title: 'AI Tool Usage',
    body:
      'Fill this section in your own words. Mention which AI tool was used, where it helped, and which parts you reviewed or changed manually.'
  },
  {
    title: 'Manual vs AI Work',
    body:
      'Write your own notes about manually designed parts, AI-suggested parts, debugging decisions, and code you personally verified.'
  },
  {
    title: 'Learning Reflection',
    body:
      'Answer the assignment questions honestly: Did AI help understanding? What integration issues appeared? What did debugging teach you?'
  },
  {
    title: 'Evidence To Add',
    body:
      'Add your own screenshots from Codex/Copilot/Cursor chat history if required by your evaluator. Do not submit generated reflection text as if it was personally written.'
  }
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function textBlock(lines, x, y, options = {}) {
  const {
    size = 26,
    fill = '#24312d',
    weight = 500,
    lineHeight = Math.round(size * 1.5),
    family = 'Inter, Arial, sans-serif'
  } = options;

  return lines
    .map((line, index) => {
      const lineY = y + index * lineHeight;
      return `<text x="${x}" y="${lineY}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join('\n');
}

function card({ x, y, width, height, title, body, accent = '#136f63' }) {
  const bodyLines = wrapText(body, width > 800 ? 92 : 44);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#dce4df"/>
    <rect x="${x}" y="${y}" width="7" height="${height}" rx="4" fill="${accent}"/>
    ${textBlock([title], x + 28, y + 40, { size: 24, weight: 800, fill: '#132923' })}
    ${textBlock(bodyLines, x + 28, y + 82, { size: 20, fill: '#63706c', lineHeight: 31 })}
  `;
}

function baseSvg({ title, subtitle, content, height = 1400 }) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
    <rect width="1200" height="${height}" fill="#f4f6f3"/>
    <rect x="52" y="52" width="1096" height="${height - 104}" rx="18" fill="#ffffff" stroke="#dce4df"/>
    <rect x="52" y="52" width="1096" height="170" rx="18" fill="#132923"/>
    <text x="92" y="118" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="900" fill="#9be3d2" letter-spacing="2">AI REFLECTION EVIDENCE</text>
    <text x="92" y="172" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900" fill="#ffffff">${escapeXml(title)}</text>
    <text x="92" y="207" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="500" fill="#d9eee8">${escapeXml(subtitle)}</text>
    ${content}
  </svg>`;
}

async function renderPng(filename, svg) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, filename));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const promptCards = promptItems
    .map((item, index) => {
      const x = index % 2 === 0 ? 92 : 620;
      const y = 270 + Math.floor(index / 2) * 230;
      return card({ x, y, width: 488, height: 215, title: item.title, body: item.body, accent: index % 2 === 0 ? '#136f63' : '#315f9d' });
    })
    .join('\n');

  await renderPng(
    '01_prompt_screenshots_summary.png',
    baseSvg({
      title: 'Prompt Screenshots Summary',
      subtitle: 'Rendered from actual project prompts and requests in this Codex thread.',
      height: 1240,
      content: promptCards
    })
  );

  const reflectionCards = reflectionSections
    .map((item, index) => card({ x: 92, y: 280 + index * 210, width: 1016, height: 165, title: item.title, body: item.body, accent: '#136f63' }))
    .join('\n');

  await renderPng(
    '02_reflection_template_screenshot.png',
    baseSvg({
      title: 'Reflection Report Template',
      subtitle: 'Use as a visual checklist; write the actual reflection in your own words.',
      height: 1220,
      content: reflectionCards
    })
  );

  const logRows = [
    ['Date/Time', 'Prompt', 'Output Summary', 'Accepted/Changed'],
    ['YYYY-MM-DD', 'Paste your prompt here', 'Summarize AI response', 'Note what you used or modified'],
    ['YYYY-MM-DD', 'Paste your prompt here', 'Summarize AI response', 'Note what you used or modified'],
    ['YYYY-MM-DD', 'Paste your prompt here', 'Summarize AI response', 'Note what you used or modified']
  ];
  const rowHeight = 98;
  const colX = [92, 270, 550, 825];
  const colWidths = [150, 250, 245, 250];
  const rowsSvg = logRows
    .map((row, rowIndex) => {
      const y = 300 + rowIndex * rowHeight;
      const fill = rowIndex === 0 ? '#132923' : '#ffffff';
      const textFill = rowIndex === 0 ? '#ffffff' : '#24312d';
      return `
        <rect x="92" y="${y}" width="1016" height="${rowHeight}" fill="${fill}" stroke="#dce4df"/>
        ${row
          .map((cell, colIndex) => {
            const lines = wrapText(cell, colIndex === 0 ? 12 : 24);
            return `
              <rect x="${colX[colIndex]}" y="${y}" width="${colWidths[colIndex]}" height="${rowHeight}" fill="transparent" stroke="#dce4df"/>
              ${textBlock(lines, colX[colIndex] + 14, y + 36, { size: 18, fill: textFill, weight: rowIndex === 0 ? 800 : 500, lineHeight: 25 })}
            `;
          })
          .join('\n')}
      `;
    })
    .join('\n');

  await renderPng(
    '03_prompt_log_template_screenshot.png',
    baseSvg({
      title: 'Prompt Log Template',
      subtitle: 'Fill in with your own dates, accepted changes, and manual debugging notes.',
      height: 880,
      content: rowsSvg
    })
  );

  await writeFile(
    path.join(outDir, 'README.md'),
    `# AI Reflections\n\nThis folder contains screenshot-style PNG evidence for the AI usage/reflection submission section.\n\nFiles:\n\n- 01_prompt_screenshots_summary.png\n- 02_reflection_template_screenshot.png\n- 03_prompt_log_template_screenshot.png\n\nNote: These are generated visual aids based on project prompts/templates. Write the final reflection and prompt log in your own words before submission.\n`,
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
