/**
 * IPTV Stream Proxy API Route
 * Proxies HLS manifests and media segments to avoid CORS issues.
 * For .m3u8 manifests, rewrites URLs to also route through this proxy.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    // Fallback: manual resolution
    const baseUrl = base.substring(0, base.lastIndexOf('/') + 1);
    return baseUrl + relative;
  }
}

function rewriteM3u8(content: string, baseUrl: string, proxyBase: string): string {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    // Skip empty lines and comments (but process URI= in EXT tags)
    if (!trimmed) return line;

    // Rewrite URI="..." in EXT-X-KEY, EXT-X-MAP, etc.
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const absoluteUri = resolveUrl(baseUrl, uri);
        return `URI="${proxyBase}${encodeURIComponent(absoluteUri)}"`;
      });
    }

    // Skip other comment lines
    if (trimmed.startsWith('#')) return line;

    // This is a segment/playlist URL line - rewrite it
    const absoluteUrl = resolveUrl(baseUrl, trimmed);
    return `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
  }).join('\n');
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const customUa = request.nextUrl.searchParams.get('ua');
  const customReferer = request.nextUrl.searchParams.get('referer');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const fetchHeaders: Record<string, string> = {
      'User-Agent': customUa || 'Mozilla/5.0 (compatible; KVideo/1.0)',
      'Accept': '*/*',
      'Referer': customReferer || `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
    };

    // Forward Range header for partial content requests
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: fetchHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let isM3u8 = url.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegURL');

    // If content-type is ambiguous, check the response body for M3U header
    // Use clone() to avoid consuming the original body for binary streams
    if (!isM3u8 && (contentType.includes('text/plain') || contentType.includes('application/octet-stream') || !contentType)) {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.trimStart().startsWith('#EXTM3U') || text.trimStart().startsWith('#EXT-X-')) {
        isM3u8 = true;
      }
      // For detected M3U8 from body check, process inline
      if (isM3u8) {
        const proxyBase = `/api/iptv/stream?${customUa ? `ua=${encodeURIComponent(customUa)}&` : ''}${customReferer ? `referer=${encodeURIComponent(customReferer)}&` : ''}url=`;
        const rewritten = rewriteM3u8(text, url, proxyBase);
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }
      // Not M3U8, stream original binary body directly to preserve data integrity
      const body = response.body;
      return new NextResponse(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'video/mp2t',
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (isM3u8) {
      // Parse and rewrite manifest
      const text = await response.text();
      const proxyBase = `/api/iptv/stream?${customUa ? `ua=${encodeURIComponent(customUa)}&` : ''}${customReferer ? `referer=${encodeURIComponent(customReferer)}&` : ''}url=`;
      const rewritten = rewriteM3u8(text, url, proxyBase);

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
          ...corsHeaders,
        },
      });
    } else {
      // Pipe through media segments directly
      const body = response.body;
      const forwardContentType = contentType || 'video/mp2t';

      const responseHeaders: Record<string, string> = {
        'Content-Type': forwardContentType,
        'Cache-Control': 'public, max-age=60',
        ...corsHeaders,
      };

      // Forward range-related headers
      const contentRange = response.headers.get('content-range');
      if (contentRange) responseHeaders['Content-Range'] = contentRange;
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;
      const contentLength = response.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;

      return new NextResponse(body, {
        status: response.status,
        headers: responseHeaders,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to proxy stream' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
