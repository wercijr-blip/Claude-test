import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://facilitaprep.com.br'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: DOMAIN,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
