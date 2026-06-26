const BLOG_MODULES = import.meta.glob('/content/blog/**/*.md', {
  eager: true,
  as: 'raw',
});

const BLOG_ASSET_URLS = import.meta.glob(
  '/content/blog/**/*.{png,jpg,jpeg,gif,webp,svg,avif}',
  {
    eager: true,
    import: 'default',
  }
);

function extractFileName(filePath) {
  const parts = String(filePath || '').split('/');
  return parts[parts.length - 1] || '';
}

function getDirName(filePath) {
  const normalized = String(filePath || '').replace(/\/+/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function normalizePath(pathValue) {
  return String(pathValue || '')
    .replace(/\/+/g, '/')
    .replace(/\/+/g, '/');
}

function resolveRelativePath(fromDir, relativePath) {
  const baseParts = normalizePath(fromDir).split('/').filter(Boolean);
  const relParts = normalizePath(relativePath).split('/').filter(Boolean);

  const stack = [...baseParts];
  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }

  return `/${stack.join('/')}`;
}

function slugifyFileName(name) {
  const base = String(name || '').replace(/\.md$/i, '');
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(markdown) {
  const normalized = String(markdown || '');
  const match = normalized.match(/^\s*---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { frontmatter: {}, content: normalized.trim() };
  }

  const raw = match[1] || '';
  const content = normalized.slice(match[0].length).trim();
  const frontmatter = {};

  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
    if (!key) continue;
    frontmatter[key] = value;
  }

  return { frontmatter, content };
}

function toReadableDate(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function extractSlug(filePath) {
  const fileName = extractFileName(filePath);
  if (fileName.toLowerCase() === 'index.md') {
    const dirName = getDirName(filePath);
    const dirParts = dirName.split('/').filter(Boolean);
    const folderName = dirParts[dirParts.length - 1] || '';
    return slugifyFileName(folderName);
  }
  return slugifyFileName(fileName);
}

function normalizeTags(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function getPostDateValue(dateValue) {
  const d = new Date(dateValue || '');
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function rewriteRelativeImageUrls(markdownContent, { slug, filePath }) {
  const content = String(markdownContent || '');
  if (!content) return content;
  const mdDir = getDirName(filePath);

  // Convert markdown image URLs like ![alt](1.png) to
  // colocated blog asset URLs when possible. Fallback to
  // /blog-images/<slug>/... for compatibility with public folder assets.
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, rawUrl) => {
    const url = String(rawUrl || '').trim();
    if (!url) return full;

    const isAbsolute =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/') ||
      url.startsWith('data:');

    if (isAbsolute) return full;

    const normalized = url.replace(/^\.\//, '');

    // Preferred: image lives next to markdown under content/blog/**
    const resolvedAssetPath = resolveRelativePath(mdDir, normalized);
    const assetUrl = BLOG_ASSET_URLS[resolvedAssetPath];
    if (assetUrl) {
      return `![${alt}](${assetUrl})`;
    }

    // Backward-compatible fallback: image in /public/blog-images/<slug>/...
    return `![${alt}](/blog-images/${slug}/${normalized})`;
  });
}

function toPost(filePath, rawMarkdown) {
  const slug = extractSlug(filePath);
  const { frontmatter, content } = parseFrontmatter(rawMarkdown);
  const contentWithImagePaths = rewriteRelativeImageUrls(content, {
    slug,
    filePath,
  });

  return {
    slug,
    title: frontmatter.title || slug,
    description: frontmatter.description || '',
    author: frontmatter.author || 'CloudAgent Team',
    date: frontmatter.date || '',
    readableDate: toReadableDate(frontmatter.date),
    tags: normalizeTags(frontmatter.tags),
    coverImage: frontmatter.coverImage || '',
    content: contentWithImagePaths,
  };
}

export function getAllBlogPosts() {
  const posts = Object.entries(BLOG_MODULES)
    .filter(([filePath]) => {
      const fileName = extractFileName(filePath);
      const slug = extractSlug(filePath);
      if (!slug) return false;
      return !fileName.startsWith('_');
    })
    .map(([filePath, rawMarkdown]) => toPost(filePath, rawMarkdown))
    .sort((a, b) => getPostDateValue(b.date) - getPostDateValue(a.date));

  return posts;
}

export function getBlogPostBySlug(slug) {
  const posts = getAllBlogPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export function getAllBlogSlugs() {
  return getAllBlogPosts().map((post) => post.slug);
}
