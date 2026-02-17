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

      if (tvgNameMatch) channel.tvgName = tvgNameMatch[1];
      if (tvgLogoMatch) channel.logo = tvgLogoMatch[1];
      if (groupTitleMatch) {
        channel.group = groupTitleMatch[1];
        if (channel.group) groupSet.add(channel.group);
      }
      if (tvgIdMatch) channel.tvgId = tvgIdMatch[1];

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
