import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const llmsPath = path.join(repoRoot, 'llms.txt');

const LIST_LINK = /^- \[([^\]]+)\]\(([^)]+)\):\s*(.*)$/;

describe('llms.txt structure', () => {
  it('is a spec-shaped index whose links resolve to files on disk', () => {
    const raw = fs.readFileSync(llmsPath, 'utf8');
    assert.ok(raw.length > 0, 'llms.txt is empty');
    assert.match(
      raw,
      /llms-full\.txt is intentionally not generated/,
      'must note why llms-full.txt is not built'
    );
    assert.equal(
      fs.existsSync(path.join(repoRoot, 'llms-full.txt')),
      false,
      'llms-full.txt must not be generated'
    );

    const body = raw.replace(/<!--[\s\S]*?-->/g, '');
    const lines = body.split(/\r?\n/);
    const contentLines = lines.filter((line) => line.trim() !== '');

    assert.equal(contentLines[0], '# Portal Colosseum', 'file must open with the project H1');
    const h1s = lines.filter((line) => /^# [^#]/.test(line));
    assert.equal(h1s.length, 1, `expected exactly one H1, found ${h1s.length}`);
    assert.ok(lines.some((line) => line.startsWith('## ')), 'expected H2 file-list sections');

    const quote = lines.filter((line) => line.startsWith('> ')).map((line) => line.slice(2).trim()).join(' ');
    assert.ok(quote.length > 0, 'missing blockquote summary');

    const links = [];
    for (const line of lines) {
      if (!line.startsWith('- [')) continue;
      const match = line.match(LIST_LINK);
      assert.ok(match, `link does not parse as "- [Title](url): Description": ${line}`);
      const title = match[1].trim();
      const url = match[2].trim();
      const description = match[3].trim();
      assert.ok(title, `empty link title: ${line}`);
      assert.ok(description, `empty description: ${line}`);
      assert.ok(!/^https?:\/\//i.test(url), `expected a repo-relative file, got ${url}`);
      assert.ok(!path.isAbsolute(url) && !url.split('/').includes('..'), `unsafe link path: ${url}`);
      links.push({ url, description });
    }

    assert.ok(links.length > 0, 'no described links found');
    const stray = [...body.matchAll(/\[[^\]]*\]\([^)]+\)/g)];
    assert.equal(stray.length, links.length, 'a markdown link is outside the spec list format');

    for (const { url } of links) {
      const filePath = path.resolve(repoRoot, url);
      assert.ok(
        filePath === repoRoot || filePath.startsWith(repoRoot + path.sep),
        `link escapes the repo: ${url}`
      );
      assert.ok(fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `linked file does not exist: ${url}`);
    }
  });
});
