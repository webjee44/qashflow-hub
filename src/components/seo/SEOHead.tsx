import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
  };
  noIndex?: boolean;
}

const BASE_URL = 'https://pennylane-cash-flow-buddy.lovable.app';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

export const SEOHead = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  article,
  noIndex = false,
}: SEOHeadProps) => {
  const location = useLocation();
  const fullUrl = canonicalUrl || `${BASE_URL}${location.pathname}`;
  
  const fullTitle = title 
    ? `${title} | qashflow - Gestion financière`
    : 'qashflow - Pilotez vos finances avec intelligence';
  
  const defaultDescription = 'Synchronisez vos banques, anticipez votre cash-flow et créez des business plans professionnels. Tout en un seul outil.';
  const fullDescription = description || defaultDescription;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Update meta tags
    updateMeta('description', fullDescription);
    if (keywords) updateMeta('keywords', keywords);
    if (noIndex) updateMeta('robots', 'noindex, nofollow');
    
    // Open Graph
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', fullDescription, true);
    updateMeta('og:url', fullUrl, true);
    updateMeta('og:type', ogType, true);
    updateMeta('og:image', ogImage, true);
    updateMeta('og:site_name', 'qashflow', true);
    updateMeta('og:locale', 'fr_FR', true);
    
    // Twitter
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', fullDescription);
    updateMeta('twitter:image', ogImage);
    updateMeta('twitter:card', 'summary_large_image');
    
    // Article specific
    if (article) {
      if (article.publishedTime) updateMeta('article:published_time', article.publishedTime, true);
      if (article.modifiedTime) updateMeta('article:modified_time', article.modifiedTime, true);
      if (article.author) updateMeta('article:author', article.author, true);
    }

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = fullUrl;

    return () => {
      // Cleanup if needed
    };
  }, [fullTitle, fullDescription, fullUrl, ogImage, ogType, keywords, article, noIndex]);

  return null;
};

// JSON-LD Schema helper
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'qashflow',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Logiciel de gestion de trésorerie et business plan pour PME et startups',
  url: BASE_URL,
  offers: {
    '@type': 'Offer',
    price: '29',
    priceCurrency: 'EUR',
    priceValidUntil: '2027-12-31',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
  },
});

export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${BASE_URL}${item.url}`,
  })),
});

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});
