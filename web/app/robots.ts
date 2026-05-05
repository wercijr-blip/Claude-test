import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://facilitaprep.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/lp/'],
    },
    sitemap: `${DOMAIN}/sitemap.xml`,
  }
}
