import { db } from "../server/db";
import { blogPosts } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";

const BASE_URL = "https://holidays.flightsandpackages.com";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

async function getAllBlogUrls(): Promise<string[]> {
  const urls: string[] = [];
  let page = 1;
  
  while (true) {
    const listUrl = page === 1 
      ? `${BASE_URL}/blog` 
      : `${BASE_URL}/blog?page=${page}`;
    
    console.log(`Fetching blog list page ${page}...`);
    const html = await fetchPage(listUrl);
    if (!html) break;
    
    const $ = cheerio.load(html);
    const links = $('a[href*="/blog/"]').map((_, el) => $(el).attr('href')).get();
    
    const blogLinks = links
      .filter(href => href && href.includes('/blog/') && !href.endsWith('/blog') && !href.includes('?page='))
      .map(href => href.startsWith('http') ? href : `${BASE_URL}${href}`);
    
    const uniqueLinks = [...new Set(blogLinks)];
    if (uniqueLinks.length === 0) break;
    
    const newLinks = uniqueLinks.filter(link => !urls.includes(link));
    if (newLinks.length === 0) break;
    
    urls.push(...newLinks);
    console.log(`Found ${newLinks.length} new blog URLs (total: ${urls.length})`);
    
    page++;
    await new Promise(r => setTimeout(r, 500));
  }
  
  return [...new Set(urls)];
}

function extractSlugFromUrl(url: string): string {
  const match = url.match(/\/blog\/([^/?#]+)/);
  return match ? match[1] : '';
}

async function scrapeBlogPost(url: string): Promise<{
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage: string | null;
  author: string;
  publishedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
} | null> {
  const html = await fetchPage(url);
  if (!html) return null;
  
  const $ = cheerio.load(html);
  const slug = extractSlugFromUrl(url);
  
  const title = $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                $('title').text().trim() || 
                slug.replace(/-/g, ' ');
  
  let featuredImage: string | null = null;
  
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && ogImage.length > 0) {
    featuredImage = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
  }
  
  if (!featuredImage) {
    const heroImg = $('.hero img, .featured-image img, .blog-header img, article img').first().attr('src');
    if (heroImg && heroImg.length > 0) {
      featuredImage = heroImg.startsWith('http') ? heroImg : `${BASE_URL}${heroImg}`;
    }
  }
  
  if (!featuredImage) {
    const firstImg = $('article img, .content img, .post-content img, main img').first().attr('src');
    if (firstImg && firstImg.length > 0) {
      featuredImage = firstImg.startsWith('http') ? firstImg : `${BASE_URL}${firstImg}`;
    }
  }
  
  if (!featuredImage) {
    const anyImg = $('img[src*="blog"], img[src*="upload"], img[src*="image"]').first().attr('src');
    if (anyImg && anyImg.length > 0) {
      featuredImage = anyImg.startsWith('http') ? anyImg : `${BASE_URL}${anyImg}`;
    }
  }
  
  let content = '';
  const contentSelectors = [
    'article .content',
    '.blog-content',
    '.post-content', 
    'article',
    '.entry-content',
    'main .content'
  ];
  
  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      content = el.html() || '';
      if (content.length > 100) break;
    }
  }
  
  if (!content) {
    content = $('main').html() || $('body').html() || '';
  }
  
  const textContent = $('<div>').html(content).text();
  const excerpt = textContent.substring(0, 250).trim() + (textContent.length > 250 ? '...' : '');
  
  const author = $('.author').text().trim() || 
                 $('[rel="author"]').text().trim() || 
                 'Flights and Packages';
  
  let publishedAt: Date | null = null;
  const dateStr = $('time').attr('datetime') || 
                  $('meta[property="article:published_time"]').attr('content') ||
                  $('.date, .published').first().text().trim();
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      publishedAt = parsed;
    }
  }
  
  const metaTitle = $('meta[property="og:title"]').attr('content') || 
                    $('title').text().trim() || 
                    title;
  
  const metaDescription = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || 
                          excerpt;
  
  return {
    title,
    slug,
    content,
    excerpt,
    featuredImage,
    author,
    publishedAt,
    metaTitle,
    metaDescription
  };
}

async function main() {
  console.log("Starting blog rescrape with images...\n");
  
  console.log("Fetching all blog URLs...");
  const blogUrls = await getAllBlogUrls();
  console.log(`Found ${blogUrls.length} blog posts to scrape\n`);
  
  if (blogUrls.length === 0) {
    console.log("No blog URLs found. Exiting.");
    return;
  }
  
  let updated = 0;
  let created = 0;
  let failed = 0;
  let withImages = 0;
  
  for (let i = 0; i < blogUrls.length; i++) {
    const url = blogUrls[i];
    console.log(`[${i + 1}/${blogUrls.length}] Scraping: ${url}`);
    
    const data = await scrapeBlogPost(url);
    if (!data) {
      console.log(`  ❌ Failed to scrape`);
      failed++;
      continue;
    }
    
    if (data.featuredImage) {
      withImages++;
      console.log(`  📷 Found image: ${data.featuredImage.substring(0, 60)}...`);
    }
    
    try {
      const existing = await db.select().from(blogPosts).where(eq(blogPosts.slug, data.slug)).limit(1);
      
      if (existing.length > 0) {
        await db.update(blogPosts)
          .set({
            title: data.title,
            content: data.content,
            excerpt: data.excerpt,
            featuredImage: data.featuredImage,
            author: data.author,
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            publishedAt: data.publishedAt || existing[0].publishedAt,
            updatedAt: new Date()
          })
          .where(eq(blogPosts.slug, data.slug));
        updated++;
        console.log(`  ✅ Updated: ${data.title.substring(0, 50)}...`);
      } else {
        await db.insert(blogPosts).values({
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt,
          featuredImage: data.featuredImage,
          author: data.author,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          isPublished: true,
          publishedAt: data.publishedAt || new Date()
        });
        created++;
        console.log(`  ✅ Created: ${data.title.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`  ❌ Database error:`, error);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log("\n========== SCRAPE COMPLETE ==========");
  console.log(`Total URLs: ${blogUrls.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
  console.log(`With images: ${withImages}`);
}

main().catch(console.error);
