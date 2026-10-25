import {
  Activity,
  Award,
  BrainCircuit,
  Flame,
  Globe,
  LineChart,
  Medal,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Swords,
  Target,
  Timer,
  Trophy,
  User,
  Users,
  Zap,
  AlertCircle,
  ExternalLink,
  Radio
} from "lucide-react";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ParsedDashboardData, ProfileData, StatsData, ClubData, TournamentData, GameHistoryData } from "../types";
import AICoach from "./AICoach";
import HistoryGraph from "./HistoryGraph";
import StatCard from "./StatCard";

const PRIMARY_USERNAME = "mennmaestro";

export default function Dashboard() {
  const [targetUsername, setTargetUsername] = useState<string>(() => {
    // Ensure default is always mennmaestro and override any old saved grandmaster
    const saved = localStorage.getItem("chess_target_username");
    if (!saved || saved !== PRIMARY_USERNAME) {
      localStorage.setItem("chess_target_username", PRIMARY_USERNAME);
      return PRIMARY_USERNAME;
    }
    return PRIMARY_USERNAME;
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [tournaments, setTournaments] = useState<{
    finished: TournamentData[];
    in_progress: TournamentData[];
    registered: TournamentData[];
  }>({ finished: [], in_progress: [], registered: [] });
  const [history, setHistory] = useState<GameHistoryData[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [visibleHistory, setVisibleHistory] = useState(6);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedDashboardData | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<"bullet" | "blitz" | "rapid">("rapid");

  const aggregatedStats = useMemo(() => {
    if (!stats) return null;
    let w = 0, l = 0, d = 0;
    const modes = ["chess_bullet", "chess_blitz", "chess_rapid", "chess_daily"] as const;
    modes.forEach((key) => {
      const r = stats[key as keyof StatsData]?.record;
      if (r) {
        w += r.win;
        l += r.loss;
        d += r.draw;
      }
    });
    const total = w + l + d;
    const winRate = total ? Math.round((w / total) * 100) : 0;
    const lossRate = total ? Math.round((l / total) * 100) : 0;
    const drawRate = total ? Math.round((d / total) * 100) : 0;

    return {
      w,
      l,
      d,
      total,
      winRate,
      lossRate,
      drawRate,
      tacticsHighest: stats.tactics?.highest?.rating || "680",
      puzzleRushBest: stats.puzzle_rush?.best?.score || "9",
      fide: stats.fide || "N/A"
    };
  }, [stats]);

  const dayProgress = useMemo(() => {
    if (!history || history.length === 0) {
      return { total: 0, w: 0, l: 0, d: 0, eloChange: 0 };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todaysGames = history.filter((game) => game.end_time * 1000 >= startOfToday);

    let w = 0, l = 0, d = 0;
    const modeChanges: Record<string, { first: number | null; last: number | null }> = {};
    const modesPlayed = new Set<string>();

    [...todaysGames].reverse().forEach((game) => {
      const isWhite = (game.white?.username || "").toLowerCase() === PRIMARY_USERNAME.toLowerCase();
      const myResult = isWhite ? game.white?.result : game.black?.result;
      const myRating = isWhite ? game.white?.rating : game.black?.rating;

      if (myResult === "win") w++;
      else if (["checkmated", "timeout", "resigned", "lose", "abandoned"].includes(myResult || "")) l++;
      else d++;

      if (!modeChanges[game.time_class]) {
        modeChanges[game.time_class] = { first: myRating, last: myRating };
      } else {
        modeChanges[game.time_class].last = myRating;
      }
      modesPlayed.add(game.time_class);
    });

    let estimatedEloChange = 0;
    const beforeTodayGames = history.filter((game) => game.end_time * 1000 < startOfToday);

    modesPlayed.forEach((mode) => {
      const priorGamesInMode = beforeTodayGames.filter((g) => g.time_class === mode);
      let startingRating;
      if (priorGamesInMode.length > 0) {
        const priorGame = priorGamesInMode[0];
        const isWhite = (priorGame.white?.username || "").toLowerCase() === PRIMARY_USERNAME.toLowerCase();
        startingRating = isWhite ? priorGame.white?.rating : priorGame.black?.rating;
      } else {
        startingRating = modeChanges[mode].first;
      }

      const finalRating = modeChanges[mode].last;
      if (startingRating !== null && finalRating !== null) {
        estimatedEloChange += finalRating - startingRating;
      }
    });

    return {
      total: todaysGames.length,
      w,
      l,
      d,
      eloChange: estimatedEloChange
    };
  }, [history]);

  // Main data fetch function for Menn Maestro
  const fetchChessData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const [profileRes, statsRes, gamesRes, clubsRes, tournRes, historyRes] = await Promise.all([
        fetch(`/api/chess/profile/${PRIMARY_USERNAME}`),
        fetch(`/api/chess/stats/${PRIMARY_USERNAME}`),
        fetch(`/api/chess/games/${PRIMARY_USERNAME}`),
        fetch(`/api/chess/clubs/${PRIMARY_USERNAME}`),
        fetch(`/api/chess/tournaments/${PRIMARY_USERNAME}`),
        fetch(`/api/chess/history/${PRIMARY_USERNAME}?offset=0`)
      ]);

      if (!profileRes.ok) {
        const errJson = await profileRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch Menn Maestro profile");
      }

      const profileData: ProfileData = await profileRes.json();
      const statsData: StatsData = statsRes.ok ? await statsRes.json() : {};
      const gamesData = gamesRes.ok ? await gamesRes.json() : { games: [] };
      const clubsData = clubsRes.ok ? await clubsRes.json() : { clubs: [] };
      const tournData = tournRes.ok ? await tournRes.json() : { finished: [], in_progress: [], registered: [] };
      const historyData = historyRes.ok ? await historyRes.json() : { games: [] };

      setProfile(profileData);
      setStats(statsData);
      setClubs(clubsData.clubs || []);
      setTournaments({
        finished: tournData.finished || [],
        in_progress: tournData.in_progress || [],
        registered: tournData.registered || []
      });
      setHistory(historyData.games || []);
      setHasMoreHistory(historyData.hasMore ?? false);
      setHistoryOffset(0);
      setVisibleHistory(6);
      setErrorNotice(null);

      // Parse standardized dashboard structure
      let liveGameActive = false;
      let opponent = null;
      let opponentRating = null;
      let currentFen = null;

      if (gamesData?.games?.length > 0) {
        const game = gamesData.games[0];
        liveGameActive = true;
        const isWhite = typeof game.white === "string" 
          ? game.white.toLowerCase().includes(PRIMARY_USERNAME)
          : game.white?.username?.toLowerCase() === PRIMARY_USERNAME;
        const opp = isWhite ? game.black : game.white;
        opponent = typeof opp === "string" ? opp.split("/").pop() : opp?.username || "Opponent";
        currentFen = game.fen || null;
      }

      const structuredFormat: ParsedDashboardData = {
        username: profileData.username,
        last_updated: new Date().toISOString(),
        ratings: {
          bullet: {
            current: statsData.chess_bullet?.last?.rating || null,
            peak: statsData.chess_bullet?.best?.rating || null
          },
          blitz: {
            current: statsData.chess_blitz?.last?.rating || null,
            peak: statsData.chess_blitz?.best?.rating || null
          },
          rapid: {
            current: statsData.chess_rapid?.last?.rating || null,
            peak: statsData.chess_rapid?.best?.rating || null
          }
        },
        live_game: {
          is_active: liveGameActive,
          opponent: opponent,
          opponent_rating: opponentRating,
          current_fen: currentFen
        }
      };

      setParsedData(structuredFormat);
      localStorage.setItem("chess_target_username", PRIMARY_USERNAME);
    } catch (err: any) {
      console.warn("Fetch error:", err.message);
      setErrorNotice(err.message || "Unable to reach Chess.com live server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChessData(!parsedData);

    // Poll periodically for live status without hammering Chess.com
    const intervalId = setInterval(() => {
      fetchChessData(false);
    }, 25000);

    return () => clearInterval(intervalId);
  }, [fetchChessData]);

  if (loading && !parsedData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-5 text-center p-6">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-2 border-white/10 border-t-white"></div>
            <Target className="absolute inset-0 m-auto h-6 w-6 text-white/80 animate-pulse" />
          </div>
          <div className="space-y-1">
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-300 font-semibold">
              SYNCHRONIZING MENN MAESTRO TELEMETRY
            </span>
            <p className="font-sans text-xs text-neutral-500">Connecting to official Chess.com account feed...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-neutral-300 selection:bg-white selection:text-black">
      {/* Top Header - Menn Maestro Command Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 py-3.5 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          
          {/* Logo & Dedicated Player Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-sm">
              <Target className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-display font-medium tracking-tight text-white">Menn Maestro</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-widest font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE SYNC
                </span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                Official Chess.com Dashboard &bull; @mennmaestro
              </p>
            </div>
          </div>

          {/* Player Quick Badge & Refresh Button */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.chess.com/member/MennMaestro"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-sans text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <span>Chess.com/member/MennMaestro</span>
              <ExternalLink className="h-3 w-3 text-neutral-400" />
            </a>

            <button
              onClick={() => fetchChessData(false)}
              disabled={refreshing}
              title="Refresh latest stats"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-mono text-neutral-200 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-white" : ""}`} />
              <span className="text-[10px] uppercase tracking-wider">
                {refreshing ? "Syncing..." : "Sync"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Non-fatal notification banner if temporary issue */}
      {errorNotice && (
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-300 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{errorNotice}. Showing latest cached Menn Maestro records.</span>
            </div>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-amber-300 hover:text-white text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 ml-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active Live Game Banner */}
      {parsedData?.live_game?.is_active && (
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-red-500 animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-white">LIVE GAME IN PROGRESS</span>
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-mono uppercase text-red-400 tracking-wider">
                    Board Active
                  </span>
                </div>
                <p className="font-sans text-xs text-neutral-400 mt-0.5">
                  Menn Maestro playing vs <strong className="text-white">{parsedData.live_game.opponent}</strong>
                </p>
              </div>
            </div>
            <a
              href="https://www.chess.com/member/MennMaestro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white hover:bg-white hover:text-black transition-all"
            >
              <span>Watch Live</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="mx-auto flex max-w-7xl flex-col xl:flex-row xl:items-start gap-8 p-4 md:p-8">
        
        {/* Left Column - Menn Maestro Identity Card & Clubs */}
        <aside className="flex flex-col gap-6 xl:w-80 shrink-0">
          
          {/* Identity Card */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-6 flex flex-col items-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 h-40 w-40 bg-white/5 blur-[80px] rounded-full pointer-events-none -mx-10 -my-10"></div>
            
            <div className="flex flex-col items-center gap-4 text-center w-full relative z-10">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="h-28 w-28 rounded-full border border-white/20 ring-4 ring-white/5 object-cover transition-transform hover:scale-105 duration-500"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-500 ring-4 ring-white/5">
                  <User className="h-10 w-10" strokeWidth={1.5} />
                </div>
              )}
              
              <div className="w-full">
                <h2 className="text-2xl font-display font-medium text-white tracking-tight">Menn Maestro</h2>
                <p className="text-xs font-mono text-neutral-400 mt-0.5">@mennmaestro</p>
                
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-sans text-[11px] font-medium tracking-wide text-amber-300">
                    <Trophy className="h-3 w-3 text-amber-400" />
                    {profile?.league || "Legend"} League
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-sans text-[11px] font-medium tracking-wide text-white/90">
                    <Globe className="h-3 w-3 text-neutral-400" />
                    Pakistan (PK)
                  </span>
                </div>
              </div>
            </div>

            {/* Followers & Status Tier */}
            <div className="mt-6 w-full grid grid-cols-2 gap-4 border-t border-white/10 pt-5 relative z-10">
              <div className="text-center">
                <p className="font-mono text-[9px] font-medium uppercase tracking-widest text-neutral-500">Followers</p>
                <p className="mt-1 font-display text-xl font-medium text-white">
                  {profile?.followers !== undefined ? profile.followers : "18"}
                </p>
              </div>
              <div className="relative text-center">
                <div className="absolute inset-y-0 left-0 w-px bg-white/10"></div>
                <p className="font-mono text-[9px] font-medium uppercase tracking-widest text-neutral-500">Tier</p>
                <p className="mt-1 flex items-center justify-center gap-1 font-display text-xl font-medium tracking-tight text-neutral-300">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  Active
                </p>
              </div>
            </div>

            <a
              href="https://www.chess.com/member/MennMaestro"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[11px] font-mono uppercase tracking-wider text-neutral-300 hover:bg-white hover:text-black transition-all"
            >
              <span>View On Chess.com</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Clubs section */}
          {clubs.length > 0 && (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Users className="h-4 w-4 text-neutral-400" />
                <h3 className="text-xs font-mono font-medium uppercase tracking-widest text-white/90">
                  Clubs ({clubs.length})
                </h3>
              </div>
              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {clubs.slice(0, 5).map((club) => (
                  <a
                    key={club.url}
                    href={club.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[16px] border border-white/5 bg-white/[0.01] p-2.5 transition-colors hover:bg-white/[0.05]"
                  >
                    {club.icon ? (
                      <img
                        src={club.icon}
                        alt={club.name}
                        className="h-7 w-7 rounded-full border border-white/10 object-cover opacity-80"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Users className="h-3.5 w-3.5 text-neutral-500" />
                      </div>
                    )}
                    <span className="text-xs font-sans font-medium text-neutral-300 truncate">{club.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          
        </aside>

        {/* Right Column - Ratings & Analytics */}
        <main className="flex-1 flex flex-col gap-6">
          
          {/* Main Ratings Grid */}
          {parsedData && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Rapid (Primary)"
                icon={<Timer className="h-4 w-4" />}
                data={parsedData.ratings.rapid}
                theme="indigo"
              />
              <StatCard
                title="Blitz"
                icon={<Flame className="h-4 w-4" />}
                data={parsedData.ratings.blitz}
                theme="orange"
              />
              <StatCard
                title="Bullet"
                icon={<Zap className="h-4 w-4" />}
                data={parsedData.ratings.bullet}
                theme="emerald"
              />
            </section>
          )}

          {/* Performance Trajectory Graph & AI Coach */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* History Graph */}
            <section className="lg:col-span-2 rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 flex flex-col">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-neutral-300 shadow-sm">
                    <LineChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-sans font-medium text-white tracking-wide">Rating Trajectory</h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mt-0.5">Menn Maestro Elo Arc</p>
                  </div>
                </div>
                
                <div className="flex bg-white/5 rounded-full p-1 border border-white/10 backdrop-blur-md">
                  {(["rapid", "blitz", "bullet"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setGraphMode(m)}
                      className={`capitalize px-3.5 py-1 text-[11px] font-sans font-medium tracking-wide rounded-full transition-all ${
                        graphMode === m
                          ? "bg-white text-black shadow-sm font-semibold"
                          : "text-neutral-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              
              {parsedData && (
                <HistoryGraph
                  currentRating={parsedData.ratings[graphMode].current}
                  peakRating={parsedData.ratings[graphMode].peak}
                  mode={graphMode}
                  color="#ffffff"
                />
              )}
            </section>

            {/* AI Coach Personalized for Menn Maestro */}
            <section className="lg:col-span-3 flex">
              <AICoach profile={profile} stats={stats} />
            </section>

          </div>

          {/* Day Progress Tracker */}
          {dayProgress && (
            <section className="flex flex-col md:flex-row justify-between items-center bg-white/[0.02] border border-white/10 rounded-[24px] p-6 md:p-8 relative overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="absolute top-0 right-0 h-64 w-64 bg-white/5 blur-[100px] rounded-full pointer-events-none -mx-10 -my-10"></div>
              
              <div className="flex items-center gap-5 z-10 w-full md:w-auto">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-white/90 shrink-0">
                  <Timer className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-display text-[15px] font-medium tracking-wide text-white">Daily Session Progress</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mt-1">
                    24H Match Telemetry
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-6 md:gap-12 w-full md:w-auto mt-6 md:mt-0 z-10 justify-start md:justify-end">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-1.5">
                    Net ELO +/-
                  </span>
                  <span
                    className={`text-4xl font-display font-medium tracking-tight leading-none ${
                      dayProgress.eloChange > 0
                        ? "text-emerald-400"
                        : dayProgress.eloChange < 0
                        ? "text-rose-400"
                        : "text-neutral-300"
                    }`}
                  >
                    {dayProgress.eloChange > 0 ? "+" : ""}
                    {dayProgress.eloChange}
                  </span>
                </div>
                
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-1.5">
                    Today's Matches
                  </span>
                  <span className="text-4xl font-display font-medium tracking-tight leading-none text-white">
                    {dayProgress.total}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="font-mono text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-1.5">
                    Win / Loss
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-medium tracking-tight leading-none text-white">
                      {dayProgress.w}
                    </span>
                    <span className="text-lg font-light font-sans text-neutral-600">/</span>
                    <span className="text-4xl font-display font-medium tracking-tight leading-none text-neutral-500">
                      {dayProgress.l}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Extended Telemetry for Menn Maestro */}
          {aggregatedStats && (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-white/80">
                    <Swords className="h-4 w-4" />
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest font-medium text-neutral-400">Total Career Record</h3>
                </div>
                <div className="mt-4 text-neutral-100">
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-display font-medium tracking-tight leading-none">{aggregatedStats.winRate}%</span>
                    <span className="font-mono text-[9px] text-neutral-500 mb-1 py-[1px] uppercase tracking-widest">Global Win Rate</span>
                  </div>
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5 mb-3 border border-white/5">
                    <div style={{ width: `${aggregatedStats.winRate}%` }} className="bg-emerald-400"></div>
                    <div style={{ width: `${aggregatedStats.drawRate}%` }} className="bg-neutral-500"></div>
                    <div style={{ width: `${aggregatedStats.lossRate}%` }} className="bg-rose-500/40"></div>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono font-medium tracking-widest uppercase mt-1">
                    <span className="text-emerald-400">{aggregatedStats.w} W</span>
                    <span className="text-neutral-400">{aggregatedStats.d} D</span>
                    <span className="text-rose-400">{aggregatedStats.l} L</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-white/80">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest font-medium text-neutral-400">Tactics Peak</h3>
                </div>
                <div className="flex flex-col mt-4">
                  <span className="text-4xl font-display font-medium text-white tracking-tight leading-none">
                    {aggregatedStats.tacticsHighest}
                  </span>
                  <span className="font-sans text-[11px] text-neutral-500 tracking-wide mt-2">Highest Tactical Elo</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-white/80">
                    <Zap className="h-4 w-4" />
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest font-medium text-neutral-400">Puzzle Rush</h3>
                </div>
                <div className="flex flex-col mt-4">
                  <span className="text-4xl font-display font-medium text-white tracking-tight leading-none">
                    {aggregatedStats.puzzleRushBest}
                  </span>
                  <span className="font-sans text-[11px] text-neutral-500 tracking-wide mt-2">Personal High Score</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-white/80">
                    <Award className="h-4 w-4" />
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest font-medium text-neutral-400">Total Games</h3>
                </div>
                <div className="flex flex-col mt-4">
                  <span className="text-4xl font-display font-medium text-white tracking-tight leading-none">
                    {aggregatedStats.total.toLocaleString()}
                  </span>
                  <span className="font-sans text-[11px] text-neutral-500 tracking-wide mt-2">Career Match Count</span>
                </div>
              </div>
              
            </section>
          )}

          {/* Menn Maestro Match History */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/5 border border-white/10 text-white/80">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-sans font-medium text-white tracking-wide">Menn Maestro Recent Games</h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mt-0.5">Live Match Archives</p>
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                {history.length} games loaded
              </span>
            </div>

            {history.length > 0 ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {history.slice(0, visibleHistory).map((game, i) => {
                    const isWhite = (game.white?.username || "").toLowerCase() === PRIMARY_USERNAME.toLowerCase();
                    const result = isWhite ? game.white?.result : game.black?.result;
                    const opponent = isWhite ? game.black : game.white;
                    let resultClass = "border border-white/10 bg-white/5 text-neutral-400";
                    let resultText = "Draw";

                    if (result === "win") {
                      resultClass = "bg-emerald-400 text-black font-semibold";
                      resultText = "Won";
                    } else if (["checkmated", "timeout", "resigned", "lose", "abandoned"].includes(result || "")) {
                      resultClass = "bg-white/[0.03] text-neutral-500 border border-white/5";
                      resultText = "Lost";
                    }

                    return (
                      <a
                        key={game.url || i}
                        href={game.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-[16px] border border-white/5 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-6 w-11 items-center justify-center rounded-full text-[9px] font-mono uppercase tracking-wider ${resultClass}`}>
                            {resultText}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-sans font-medium text-white">
                              vs {opponent?.username || "Opponent"}
                            </span>
                            <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase mt-0.5">
                              {game.time_class} &bull; {new Date(game.end_time * 1000).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-medium text-neutral-400">
                            {isWhite ? game.white?.rating : game.black?.rating}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>

                {(hasMoreHistory || visibleHistory < history.length) && (
                  <button
                    onClick={async () => {
                      if (visibleHistory < history.length) {
                        setVisibleHistory((prev) => prev + 5);
                        return;
                      }
                      if (!hasMoreHistory) return;

                      setLoadingMoreHistory(true);
                      try {
                        const nextOffset = historyOffset + 1;
                        const res = await fetch(
                          `/api/chess/history/${PRIMARY_USERNAME}?offset=${nextOffset}`
                        );
                        const data = await res.json();
                        setHistory((prev) => [...prev, ...(data.games || [])]);
                        setHistoryOffset(nextOffset);
                        setHasMoreHistory(data.hasMore);
                        setVisibleHistory((prev) => prev + 5);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoadingMoreHistory(false);
                      }
                    }}
                    disabled={loadingMoreHistory}
                    className="mt-4 w-full rounded-full border border-white/10 bg-white/5 py-3 text-[10px] font-mono uppercase font-medium tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50 flex justify-center gap-2 items-center"
                  >
                    {loadingMoreHistory ? "Loading older games..." : "Load More Matches"}
                  </button>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-neutral-500">
                <Activity className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs font-sans">No recent match history found for @mennmaestro.</p>
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
