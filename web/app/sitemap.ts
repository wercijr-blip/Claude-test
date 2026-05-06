import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://www.facilitaprep.com.br'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: DOMAIN,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${DOMAIN}/lp/google`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${DOMAIN}/lp/meta`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${DOMAIN}/duvidas`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${DOMAIN}/privacidade`,
      lastModified: new Date('2025-05-06'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${DOMAIN}/termos`,
      lastModified: new Date('2025-05-06'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
