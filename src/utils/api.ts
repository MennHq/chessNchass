import { ProfileData, StatsData, ClubData, TournamentData, GameHistoryData } from "../types";

// Seed fallback data for Menn and Noman so dashboard renders instantly without network failure
export const FALLBACK_PROFILES: Record<string, ProfileData> = {
  mennmaestro: {
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/497600595.24c3b756.200x200o.6990d9d351b0.png",
    name: "Menn",
    username: "mennmaestro",
    followers: 17,
    country: "https://api.chess.com/pub/country/PK",
    last_online: 1790448130,
    joined: 1762111881,
    status: "basic",
    is_streamer: false,
    verified: false,
    league: "Legend",
  },
  noman1119: {
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/493569401.76c85538.200x200o.69ce584cb82f.jpg",
    name: "Noman",
    username: "noman1119",
    followers: 10,
    country: "https://api.chess.com/pub/country/PK",
    last_online: 1790427639,
    joined: 1760882811,
    status: "basic",
    is_streamer: false,
    verified: false,
    league: "Crystal",
  },
};

export const FALLBACK_STATS: Record<string, StatsData> = {
  mennmaestro: {
    chess_rapid: {
      last: { rating: 548, date: 1790446998, rd: 32 },
      best: { rating: 564, date: 1790437771, game: "https://www.chess.com/game/live/146459317262" },
      record: { win: 451, loss: 443, draw: 61 },
    },
    chess_blitz: {
      last: { rating: 251, date: 1787656280, rd: 96 },
      best: { rating: 298, date: 1763820588, game: "https://www.chess.com/game/live/169215965968" },
      record: { win: 8, loss: 11, draw: 0 },
    },
    chess_bullet: {
      last: { rating: 187, date: 1786779032, rd: 59 },
      best: { rating: 453, date: 1766687175, game: "https://www.chess.com/game/live/147798941376" },
      record: { win: 34, loss: 38, draw: 0 },
    },
    tactics: {
      highest: { rating: 1049, date: 1786186445 },
      lowest: { rating: 123, date: 1764265012 },
    },
    puzzle_rush: {
      best: { total_attempts: 7, score: 4 },
    },
  },
  noman1119: {
    chess_rapid: {
      last: { rating: 484, date: 1790427639, rd: 56 },
      best: { rating: 1500, date: 1760884210, game: "https://www.chess.com/game/live/167998239534" },
      record: { win: 191, loss: 184, draw: 18 },
    },
    chess_blitz: {
      last: { rating: 486, date: 1774179719, rd: 246 },
      best: { rating: 486, date: 1774179719, game: "https://www.chess.com/game/live/166277582782" },
      record: { win: 1, loss: 0, draw: 0 },
    },
    chess_bullet: {
      last: { rating: 170, date: 1784781531, rd: 129 },
      best: { rating: 325, date: 1771035517, game: "https://www.chess.com/game/live/164591237184" },
      record: { win: 3, loss: 5, draw: 0 },
    },
    tactics: {
      highest: { rating: 921, date: 1761146784 },
      lowest: { rating: 269, date: 1768198917 },
    },
    puzzle_rush: {
      best: { total_attempts: 0, score: 0 },
    },
  },
};

/**
 * Normalizes username to lowercase and aliases legacy handles
 */
export function normalizeUsername(username: string): string {
  const trimmed = (username || "").trim().toLowerCase();
  if (trimmed === "menn-here" || trimmed === "menn" || trimmed === "mennmaestro") {
    return "mennmaestro";
  }
  return trimmed;
}

/**
 * Resolves the backend API Host dynamically
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const customBase = (import.meta as any).env?.VITE_API_URL;
  if (customBase) {
    return `${customBase.replace(/\/$/, "")}${cleanPath}`;
  }
  return cleanPath;
}

// LocalStorage cache helpers
function getCached<T>(key: string): T | null {
  try {
    const val = localStorage.getItem(`chess_cache_${key}`);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

function setCached(key: string, data: any): void {
  try {
    localStorage.setItem(`chess_cache_${key}`, JSON.stringify(data));
  } catch {}
}

async function fetchWithTimeout(url: string, timeoutMs: number = 7000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchChessProfile(username: string): Promise<ProfileData> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `profile_${targetUser}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/profile/${encodeURIComponent(targetUser)}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.username) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Proxy profile fetch failed for ${targetUser}, checking local cache:`, err);
  }

  // Fallback to cache or pre-seeded data
  const cached = getCached<ProfileData>(cacheKey);
  if (cached) return cached;

  if (FALLBACK_PROFILES[targetUser]) {
    return FALLBACK_PROFILES[targetUser];
  }

  return {
    username: targetUser,
    name: targetUser === "mennmaestro" ? "Menn" : targetUser,
    followers: 0,
    country: "https://api.chess.com/pub/country/PK",
    last_online: Date.now() / 1000,
    joined: Date.now() / 1000,
    status: "basic",
    is_streamer: false,
    verified: false,
    league: "Bronze",
  };
}

export async function fetchChessStats(username: string): Promise<StatsData> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `stats_${targetUser}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/stats/${encodeURIComponent(targetUser)}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Proxy stats fetch failed for ${targetUser}, checking local cache:`, err);
  }

  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;

  if (FALLBACK_STATS[targetUser]) {
    return FALLBACK_STATS[targetUser];
  }

  return {};
}

export async function fetchChessGames(username: string): Promise<{ games: any[] }> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `games_${targetUser}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/games/${encodeURIComponent(targetUser)}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && Array.isArray(data.games)) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Proxy games fetch failed for ${targetUser}:`, err);
  }

  const cached = getCached<{ games: any[] }>(cacheKey);
  return cached || { games: [] };
}

export async function fetchChessClubs(username: string): Promise<{ clubs: ClubData[] }> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `clubs_${targetUser}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/clubs/${encodeURIComponent(targetUser)}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && Array.isArray(data.clubs)) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch {}

  const cached = getCached<{ clubs: ClubData[] }>(cacheKey);
  return cached || { clubs: [] };
}

export async function fetchChessTournaments(username: string): Promise<{ finished: TournamentData[]; in_progress: TournamentData[]; registered: TournamentData[] }> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `tourn_${targetUser}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/tournaments/${encodeURIComponent(targetUser)}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch {}

  const cached = getCached<any>(cacheKey);
  return cached || { finished: [], in_progress: [], registered: [] };
}

export async function fetchChessHistory(username: string, offset: number = 0): Promise<{ games: GameHistoryData[]; hasMore: boolean }> {
  const targetUser = normalizeUsername(username);
  const cacheKey = `history_${targetUser}_${offset}`;

  try {
    const proxyRes = await fetchWithTimeout(getApiUrl(`/api/chess/history/${encodeURIComponent(targetUser)}?offset=${offset}`));
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && Array.isArray(data.games)) {
        setCached(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`Proxy history fetch failed for ${targetUser}:`, err);
  }

  const cached = getCached<{ games: GameHistoryData[]; hasMore: boolean }>(cacheKey);
  return cached || { games: [], hasMore: false };
}
