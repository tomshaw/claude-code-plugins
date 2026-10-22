import type { Review } from '../types'
import { formatMinutes } from './history'

export const PROJECT_COLORS = ['#6d8cf5', '#3fae7a', '#e0953a', '#a072e8', '#2fa8c9', '#e25d7a', '#8a9a3a', '#c76b3a']

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const plural = (count: number, word: string): string => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`

const list = (items: readonly string[], className: string, mark: string): string =>
  items.length === 0 ? '' : `<ul class="${className}">${items.map(item => `<li><span class="mark">${mark}</span>${escapeHtml(item)}</li>`).join('')}</ul>`

export const renderHtml = (review: Review): string => {
  const peak = Math.max(1, ...review.activity.map(bucket => bucket.count))
  const generated = new Date(review.generatedAt).toISOString().slice(0, 16).replace('T', ' ')
  const bars = review.activity
    .map(
      bucket => `<div class="bar" title="${escapeHtml(bucket.label)}: ${plural(bucket.count, 'prompt')}">
          <div class="fill" style="height:${Math.round((bucket.count / peak) * 100)}%"></div>
          <span>${escapeHtml(bucket.label)}</span>
        </div>`,
    )
    .join('')

  const projects = review.projects
    .map((project, index) => {
      const color = PROJECT_COLORS[index % PROJECT_COLORS.length]
      const threads = project.threads
        .map(
          thread => `<details class="thread" open>
            <summary><span class="title">${escapeHtml(thread.title)}</span><span class="count">${plural(thread.prompts, 'prompt')}</span></summary>
            ${thread.goal === '' ? '' : `<p class="goal">${escapeHtml(thread.goal)}</p>`}
            ${list(thread.decisions, 'decisions', '✓')}
            ${list(thread.open, 'open', '○')}
          </details>`,
        )
        .join('')

      return `<section class="project" style="--accent:${color}">
        <header>
          <h2><span class="dot"></span>${escapeHtml(project.name)}</h2>
          <p class="meta">${plural(project.prompts, 'prompt')} · ~${formatMinutes(project.activeMinutes)} active</p>
        </header>
        <p class="path">${escapeHtml(project.path)}</p>
        ${project.summary === '' ? '' : `<p class="summary">${escapeHtml(project.summary)}</p>`}
        ${threads}
      </section>`
    })
    .join('')

  const skipped =
    review.skippedProjects.length === 0
      ? ''
      : `<p class="skipped">Also active: ${review.skippedProjects.map(project => `${escapeHtml(project.name)} (${project.prompts})`).join(', ')}</p>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Work journal · ${escapeHtml(review.window.label)}</title>
<style>
  :root {
    --bg: #f6f5f1; --card: #ffffff; --ink: #1d1d1b; --muted: #6b6a64; --line: #e4e2da;
    --chip: #efede6; --good: #2f8f5b; --open: #b7791f;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #15161a; --card: #1e2026; --ink: #ecebe6; --muted: #9a9993; --line: #2d3038;
      --chip: #272a32; --good: #5cc48a; --open: #e2b154;
      color-scheme: dark;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 980px; margin: 0 auto; padding: 48px 16px 64px; }
  .eyebrow { margin: 0; color: var(--muted); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 6px 0 4px; font-size: clamp(28px, 4vw, 40px); line-height: 1.15; letter-spacing: -.02em; }
  .headline { margin: 0 0 28px; color: var(--muted); font-size: 17px; max-width: 60ch; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
  .stat b { display: block; font-size: 26px; letter-spacing: -.02em; }
  .stat span { color: var(--muted); font-size: 13px; }
  .chart { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 16px 10px; margin-bottom: 28px; }
  .chart h3 { margin: 0 0 10px; font-size: 13px; color: var(--muted); font-weight: 600; }
  .bars { display: flex; align-items: flex-end; gap: 4px; height: 120px; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
  .fill { width: 100%; max-width: 34px; min-height: 2px; border-radius: 5px 5px 2px 2px; background: linear-gradient(180deg, #8aa2f7, #5b77e6); }
  .bar span { margin-top: 6px; font-size: 11px; color: var(--muted); white-space: nowrap; }
  .project { background: var(--card); border: 1px solid var(--line); border-top: 4px solid var(--accent); border-radius: 14px; padding: 20px 22px; margin-bottom: 18px; }
  .project header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; }
  .project h2 { margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); display: inline-block; }
  .meta { margin: 0; color: var(--muted); font-size: 13px; }
  .path { margin: 2px 0 10px; color: var(--muted); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
  .summary { margin: 0 0 14px; }
  .thread { border-top: 1px solid var(--line); padding: 10px 0 4px; }
  .thread summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
  .thread summary::-webkit-details-marker { display: none; }
  .thread summary::before { content: "▸"; color: var(--accent); margin-right: 8px; transition: transform .15s; display: inline-block; }
  .thread[open] summary::before { transform: rotate(90deg); }
  .title { flex: 1; }
  .count { color: var(--muted); font-weight: 400; font-size: 13px; white-space: nowrap; background: var(--chip); padding: 1px 8px; border-radius: 999px; }
  .goal { margin: 6px 0 6px 20px; color: var(--muted); }
  .decisions, .open { list-style: none; margin: 4px 0 6px 20px; padding: 0; }
  .decisions li, .open li { margin: 3px 0; padding-left: 22px; position: relative; }
  .mark { position: absolute; left: 0; font-weight: 700; }
  .decisions .mark { color: var(--good); }
  .open .mark { color: var(--open); }
  .skipped, footer { color: var(--muted); font-size: 13px; }
  footer { margin-top: 32px; border-top: 1px solid var(--line); padding-top: 14px; }
  @media print {
    body { background: #fff; color: #000; }
    main { padding: 0; }
    .project, .stat, .chart { break-inside: avoid; box-shadow: none; }
    .thread summary::before { display: none; }
  }
</style>
</head>
<body>
<main>
  <p class="eyebrow">Work journal · ${escapeHtml(review.window.kind === 'day' ? 'Daily' : review.window.kind === 'week' ? 'Weekly' : 'Monthly')} review</p>
  <h1>${escapeHtml(review.window.label)}</h1>
  <p class="headline">${escapeHtml(review.headline)}</p>
  <div class="stats">
    <div class="stat"><b>${review.prompts.toLocaleString('en-US')}</b><span>prompts</span></div>
    <div class="stat"><b>${review.projects.length + review.skippedProjects.length}</b><span>projects</span></div>
    <div class="stat"><b>~${formatMinutes(review.activeMinutes)}</b><span>active</span></div>
    <div class="stat"><b>${review.projects.reduce((sum, project) => sum + project.threads.length, 0)}</b><span>threads</span></div>
  </div>
  <div class="chart">
    <h3>Prompts per ${review.window.kind === 'day' ? 'hour' : 'day'}</h3>
    <div class="bars">${bars}</div>
  </div>
  ${projects}
  ${skipped}
  <footer>Summarized from your Claude Code prompt history · generated ${generated} UTC · work-journal</footer>
</main>
</body>
</html>
`
}
