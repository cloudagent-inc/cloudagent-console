import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  APP_NAME,
  APP_URL,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
  DEFAULT_SOCIAL_IMAGE,
} from '../config/appConfig';

const DEFAULT_TITLE = DEFAULT_SEO_TITLE;
const DEFAULT_DESCRIPTION = DEFAULT_SEO_DESCRIPTION;
const BASE_URL = APP_URL;

/**
 * Custom hook to manage SEO meta tags dynamically
 * @param {Object} options - SEO configuration
 * @param {string} options.title - Page title (will be prefixed with the configured app name)
 * @param {string} options.description - Page description
 * @param {string} options.image - Open Graph image URL (optional)
 * @param {string} options.type - Open Graph type (default: 'website')
 * @param {boolean} options.enabled - Whether to apply SEO updates (default: true)
 */
export const useSEO = ({
  title,
  description,
  image = DEFAULT_SOCIAL_IMAGE,
  type = 'website',
  enabled = true,
}) => {
  const location = useLocation();
  const currentUrl = `${BASE_URL}${location.pathname}`;

  useEffect(() => {
    if (!enabled) return;

    // Update document title
    const fullTitle = title ? `${APP_NAME}: ${title}` : DEFAULT_TITLE;
    document.title = fullTitle;

    // Helper function to update or create meta tag
    const updateMetaTag = (attributeName, attributeValue, content) => {
      const selector = `meta[${attributeName}="${attributeValue}"]`;
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Update or create meta tags
    updateMetaTag('name', 'title', fullTitle);
    updateMetaTag('name', 'description', description || DEFAULT_DESCRIPTION);

    // Open Graph tags
    updateMetaTag('property', 'og:title', fullTitle);
    updateMetaTag('property', 'og:description', description || DEFAULT_DESCRIPTION);
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:type', type);

    // Twitter Card tags
    updateMetaTag('name', 'twitter:title', fullTitle);
    updateMetaTag('name', 'twitter:description', description || DEFAULT_DESCRIPTION);
    updateMetaTag('name', 'twitter:url', currentUrl);
    updateMetaTag('name', 'twitter:image', image);

    // Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', currentUrl);

    // Cleanup function - reset to defaults when component unmounts
    return () => {
      document.title = DEFAULT_TITLE;
      updateMetaTag('name', 'title', DEFAULT_TITLE);
      updateMetaTag('name', 'description', DEFAULT_DESCRIPTION);
      updateMetaTag('property', 'og:title', DEFAULT_TITLE);
      updateMetaTag('property', 'og:description', DEFAULT_DESCRIPTION);
      updateMetaTag('property', 'og:url', BASE_URL);
      updateMetaTag('name', 'twitter:title', DEFAULT_TITLE);
      updateMetaTag('name', 'twitter:description', DEFAULT_DESCRIPTION);
      updateMetaTag('name', 'twitter:url', BASE_URL);
      if (canonicalLink) {
        canonicalLink.setAttribute('href', BASE_URL);
      }
    };
  }, [title, description, image, type, enabled, currentUrl]);
};
