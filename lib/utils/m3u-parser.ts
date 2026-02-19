/**
 * M3U Playlist Parser
 * Parses M3U/M3U8 IPTV playlist format
 */

export interface M3UChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  routes?: string[];
  sourceId?: string;
  sourceName?: string;
  httpUserAgent?: string;
  httpReferrer?: string;
}

export interface M3UPlaylist {
  channels: M3UChannel[];
  groups: string[];
}

/**
 * Parse M3U playlist content into structured data
 */
export function parseM3U(content: string): M3UPlaylist {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const channels: M3UChannel[] = [];
  const groupSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const channel: M3UChannel = { name: '', url: '' };

      // Extract attributes from EXTINF
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/i);
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const httpUserAgentMatch = line.match(/http-user-agent="([^"]*)"/i);
      const httpReferrerMatch = line.match(/http-referrer="([^"]*)"/i);

      if (tvgNameMatch) channel.tvgName = tvgNameMatch[1];
      if (tvgLogoMatch) channel.logo = tvgLogoMatch[1];
      if (groupTitleMatch) {
        channel.group = groupTitleMatch[1];
        if (channel.group) groupSet.add(channel.group);
      }
      if (tvgIdMatch) channel.tvgId = tvgIdMatch[1];
      if (httpUserAgentMatch) channel.httpUserAgent = httpUserAgentMatch[1];
      if (httpReferrerMatch) channel.httpReferrer = httpReferrerMatch[1];

      // Extract channel name (after last comma)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        channel.name = line.substring(commaIndex + 1).trim();
      }

      // Next non-comment line should be the URL
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith('#')) {
          channel.url = lines[j];
          i = j; // Skip to after URL
          break;
        }
      }

      if (channel.name && channel.url) {
        // Use tvgName as fallback for name
        if (!channel.name && channel.tvgName) {
          channel.name = channel.tvgName;
        }
        channels.push(channel);
      }
    }
  }

  return {
    channels,
    groups: Array.from(groupSet).sort(),
  };
}

/**
 * Group channels with the same name into single entries with multiple routes.
 * This merges duplicate channel names (common in M3U playlists with multiple streams).
 */
export function groupChannelsByName(channels: M3UChannel[]): M3UChannel[] {
  const groups = new Map<string, M3UChannel>();

  for (const ch of channels) {
    const key = `${ch.sourceId || ''}::${ch.name.toLowerCase().trim()}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.routes) {
        existing.routes = [existing.url];
      }
      if (!existing.routes.includes(ch.url)) {
        existing.routes.push(ch.url);
      }
      // Use first logo found
      if (!existing.logo && ch.logo) existing.logo = ch.logo;
    } else {
      groups.set(key, { ...ch });
    }
  }

  // Only add routes array when there are multiple routes
  const result = Array.from(groups.values());
  for (const ch of result) {
    if (ch.routes && ch.routes.length <= 1) {
      delete ch.routes;
    }
  }
  return result;
}
