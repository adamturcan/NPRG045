import { onCLS, onINP, onFCP, onLCP, onTTFB } from "web-vitals";

/**
 * Reports Web Vitals metrics to console (and can be extended to send to analytics endpoint).
 * 
 * Web Vitals are key performance metrics that measure user experience:
 * - LCP (Largest Contentful Paint): Loading performance
 * - INP (Interaction to Next Paint): Interactivity (replaces FID in v5+)
 * - CLS (Cumulative Layout Shift): Visual stability
 * - FCP (First Contentful Paint): Initial rendering
 * - TTFB (Time to First Byte): Server response time
 * 
 * @see https://web.dev/vitals/
 */
export function reportWebVitals() {
  const logMetric = (metric: { name: string; value: number; id: string; rating: string }) => {
    const { name, value, id, rating } = metric;
    const emoji = rating === "good" ? "✅" : rating === "needs-improvement" ? "⚠️" : "❌";
    
    console.log(
      `[Web Vitals] ${emoji} ${name}: ${Math.round(value)}ms (${rating}) [${id}]`
    );
    
    // Future: Send to analytics endpoint
    // if (import.meta.env.PROD) {
    //   fetch('/api/analytics/vitals', {
    //     method: 'POST',
    //     body: JSON.stringify(metric),
    //   });
    // }
  };

  // Largest Contentful Paint - measures loading performance
  onLCP(logMetric);

  // Interaction to Next Paint - measures interactivity (replaces FID)
  onINP(logMetric);

  // Cumulative Layout Shift - measures visual stability
  onCLS(logMetric);

  // First Contentful Paint - measures initial rendering
  onFCP(logMetric);

  // Time to First Byte - measures server response time
  onTTFB(logMetric);
}

