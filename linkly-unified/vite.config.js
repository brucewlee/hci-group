import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function addArxivPdfMiddleware(server) {
  server.middlewares.use('/api/arxiv-pdf', async (req, res) => {
    const requestUrl = req.url || ''
    const identifierMatch = requestUrl.match(/^\/([^/?#]+(?:\.pdf)?)/i)

    if (!identifierMatch) {
      res.statusCode = 400
      res.end('Missing arXiv PDF identifier.')
      return
    }

    const identifier = identifierMatch[1].replace(/\.pdf$/i, '')
    const upstreamUrl = `https://arxiv.org/pdf/${identifier}.pdf`

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        redirect: 'follow',
        headers: {
          Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: 'https://arxiv.org/',
        },
      })

      if (!upstreamResponse.ok) {
        res.statusCode = upstreamResponse.status
        res.end(`Upstream arXiv request failed with status ${upstreamResponse.status}.`)
        return
      }

      const arrayBuffer = await upstreamResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = upstreamResponse.headers.get('content-type') || 'application/pdf'

      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', buffer.byteLength)
      res.end(buffer)
    } catch (error) {
      res.statusCode = 502
      res.end(
        error instanceof Error
          ? error.message
          : 'Unable to retrieve the arXiv PDF locally.',
      )
    }
  })
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'arxiv-pdf-dev-middleware',
      configureServer(server) {
        addArxivPdfMiddleware(server)
      },
      configurePreviewServer(server) {
        addArxivPdfMiddleware(server)
      },
    },
  ],
})
