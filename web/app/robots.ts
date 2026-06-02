import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? 'https://www.facilitaprep.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/trpc/',
        '/admin/',
        '/medico/',
        '/secretaria/',
        '/auditoria/',
        '/dashboard/',
        '/formulario/',
        '/acesso/',
        '/pagamento/',
        '/inicio/',
        '/pesquisa/',
        '/auth/',
        '/v/',
      ],
    },
    sitemap: `${DOMAIN}/sitemap.xml`,
  }
}
