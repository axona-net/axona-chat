// src/services/LinkPreviewService.js

class LinkPreviewService {
  constructor() {
    this.cache = new Map();
    
    // Popular sites local database for robust fallback or offline previews
    this.localMocks = {
      'github.com': {
        title: "GitHub: Let's build from here",
        description: "GitHub is where over 100 million developers shape the future of software, hosting code, collaborating on projects, and building together.",
        image: "https://github.githubassets.com/images/modules/open_graph/github-logo.png",
        logo: "https://github.githubassets.com/favicons/favicon.svg",
        publisher: "GitHub"
      },
      'wikipedia.org': {
        title: "Wikipedia, the free encyclopedia",
        description: "Wikipedia is a free online encyclopedia, created and edited by volunteers around the world and hosted by the Wikimedia Foundation.",
        image: "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/1200px-Wikipedia-logo-v2.svg.png",
        logo: "https://en.wikipedia.org/favicon.ico",
        publisher: "Wikipedia"
      },
      'news.ycombinator.com': {
        title: "Hacker News",
        description: "A social news website focusing on computer science, technology, and entrepreneurship, run by Y Combinator.",
        image: "https://news.ycombinator.com/y18.gif",
        logo: "https://news.ycombinator.com/favicon.ico",
        publisher: "Y Combinator"
      },
      'google.com': {
        title: "Google",
        description: "Search the world's information, including webpages, images, videos and more. Google has many special features to help you find exactly what you're looking for.",
        image: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
        logo: "https://www.google.com/favicon.ico",
        publisher: "Google"
      }
    };
  }

  // Get generic metadata fallback based on URL structure
  getFallbackMetadata(urlStr) {
    try {
      const url = new URL(urlStr);
      const host = url.hostname.replace('www.', '');
      
      // Check if we have a specific mock for this hostname
      if (this.localMocks[host]) {
        return {
          ...this.localMocks[host],
          url: urlStr
        };
      }

      // Check partial domain match
      for (const [key, mock] of Object.entries(this.localMocks)) {
        if (host.endsWith(key)) {
          return {
            ...mock,
            url: urlStr
          };
        }
      }

      // Default generic fallback card
      return {
        title: `${host.charAt(0).toUpperCase() + host.slice(1)} — Link Preview`,
        description: `Visit ${host} to check out this link.`,
        image: null,
        logo: `https://www.google.com/s2/favicons?sz=64&domain=${host}`,
        publisher: host.toUpperCase(),
        url: urlStr
      };
    } catch (e) {
      return {
        title: "Link Preview",
        description: `External link: ${urlStr}`,
        image: null,
        logo: null,
        publisher: "LINK",
        url: urlStr
      };
    }
  }

  // Fetch metadata for URL (with caching)
  async fetchPreview(urlStr) {
    if (!urlStr) return null;
    
    // Normalize URL
    let formattedUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    if (this.cache.has(formattedUrl)) {
      return this.cache.get(formattedUrl);
    }

    try {
      // Set a 4-second timeout for live fetch
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(formattedUrl)}`, {
        signal: controller.signal
      });
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`Microlink API returned ${response.status}`);
      }

      const json = await response.json();
      if (json.status === 'success' && json.data) {
        const d = json.data;
        const metadata = {
          title: d.title || this.getFallbackMetadata(formattedUrl).title,
          description: d.description || this.getFallbackMetadata(formattedUrl).description,
          image: d.image?.url || d.image || null,
          logo: d.logo?.url || d.logo || `https://www.google.com/s2/favicons?sz=64&domain=${new URL(formattedUrl).hostname}`,
          publisher: d.publisher || new URL(formattedUrl).hostname.replace('www.', '').toUpperCase(),
          url: formattedUrl
        };
        this.cache.set(formattedUrl, metadata);
        return metadata;
      }
    } catch (err) {
      console.warn(`Failed live link preview for ${formattedUrl}, using fallback.`, err);
    }

    // Fall back to mock or generic preview card
    const fallback = this.getFallbackMetadata(formattedUrl);
    this.cache.set(formattedUrl, fallback);
    return fallback;
  }
}

export default new LinkPreviewService();
