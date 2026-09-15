import axios from 'axios';
import { decryptObject } from '../lib/crypto.js';
import type { Site } from '@autoblog/shared';

interface WordPressCredentials {
  username: string;
  appPassword: string;
}

interface WordPressPost {
  id: number;
  link: string;
}

export async function uploadMediaToWordPress(
  site: Site,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }
): Promise<number> {
  const credentials = decryptObject(site.credentials as Record<string, string>) as unknown as WordPressCredentials;
  const token = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

  const response = await axios.post(
    `${site.url.replace(/\/$/, '')}/wp-json/wp/v2/media`,
    file.buffer,
    {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': file.mimetype,
        'Content-Disposition': `attachment; filename="${file.originalname}"`,
      },
    }
  );

  return response.data.id;
}

export async function publishToWordPress(
  site: Site,
  post: {
    title: string;
    content: string;
    excerpt?: string;
    slug: string;
    featuredMediaId?: number;
    categories?: string[];
    tags?: string[];
    metaDescription?: string;
    seoTitle?: string;
    focusKeyword?: string;
    schemaMarkup?: string;
    authorWpId?: number;
  }
): Promise<WordPressPost> {
  const credentials = decryptObject(site.credentials as Record<string, string>) as unknown as WordPressCredentials;
  
  const token = Buffer.from(
    `${credentials.username}:${credentials.appPassword}`
  ).toString('base64');
  
  const siteUrl = site.url.replace(/\/$/, '');

  // Resolve category names to WP category IDs
  let categoryIds: number[] = [];
  if (post.categories?.length) {
    try {
      const catRes = await axios.get(
        `${siteUrl}/wp-json/wp/v2/categories?per_page=100`,
        { headers: { Authorization: `Basic ${token}` } }
      );
      const wpCats = catRes.data;
      for (const catName of post.categories) {
        const cleanCatName = catName.trim();
        const found = wpCats.find((c: any) =>
          c.name.toLowerCase() === cleanCatName.toLowerCase()
        );
        if (found) {
          categoryIds.push(found.id);
        } else {
          try {
            const createRes = await axios.post(
              `${siteUrl}/wp-json/wp/v2/categories`,
              { name: cleanCatName },
              { headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" } }
            );
            categoryIds.push(createRes.data.id);
          } catch (err) {
            console.warn(`Failed to create category: ${cleanCatName}`);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to resolve categories");
    }
  }

  // Resolve tag names to WP tag IDs (create tag if it doesn't exist)
  let tagIds: number[] = [];
  if (post.tags?.length) {
    for (const rawTag of post.tags) {
      const tagName = rawTag.trim().replace(/^#/, "");
      try {
        const searchRes = await axios.get(
          `${siteUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`,
          { headers: { Authorization: `Basic ${token}` } }
        );
        const existing = searchRes.data.find(
          (t: any) => t.name.toLowerCase() === tagName.toLowerCase()
        );
        if (existing) {
          tagIds.push(existing.id);
        } else {
          const createRes = await axios.post(
            `${siteUrl}/wp-json/wp/v2/tags`,
            { name: tagName },
            { headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" } }
          );
          tagIds.push(createRes.data.id);
        }
      } catch (e) {
        console.warn(`Failed to resolve tag: ${tagName}`);
      }
    }
  }

  // Inject schema markup into content if present
  let finalContent = post.content;
  if (post.schemaMarkup) {
    finalContent = `${post.content}
    <script type="application/ld+json">
    ${post.schemaMarkup}
    </script>`;
  }

  const wpPayload: any = {
    title: post.title,
    content: finalContent,
    excerpt: post.metaDescription || post.excerpt || "",
    slug: post.slug,
    status: 'publish',
    categories: categoryIds.length > 0 ? categoryIds : undefined,
    tags: tagIds.length > 0 ? tagIds : undefined,
    ...(post.featuredMediaId && { featured_media: post.featuredMediaId }),
    ...(post.authorWpId && { author: post.authorWpId }),
  };

  // If Yoast SEO plugin is active on the site, set Yoast meta
  if (post.seoTitle || post.metaDescription) {
    wpPayload.meta = {
      ...(post.seoTitle && { _yoast_wpseo_title: post.seoTitle }),
      ...(post.metaDescription && { 
        _yoast_wpseo_metadesc: post.metaDescription 
      }),
      ...(post.focusKeyword && { 
        _yoast_wpseo_focuskw: post.focusKeyword 
      }),
    };
  }

  const response = await axios.post(
    `${siteUrl}/wp-json/wp/v2/posts`,
    wpPayload,
    {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return {
    id: response.data.id,
    link: response.data.link,
  };
}

export async function testWordPressConnection(
  url: string,
  username: string,
  appPassword: string
): Promise<boolean> {
  try {
    const token = Buffer.from(`${username}:${appPassword}`).toString('base64');
    
    await axios.get(`${url.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    return true;
  } catch (error) {
    console.error('WordPress connection test failed:', error);
    return false;
  }
}
