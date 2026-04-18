import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';
import { computeStats, fmt } from '../../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_COLORS = {
  Sydney: '#85B7EB', Tokyo: '#A78BFA', London: '#5DCAA5',
  'New York': '#E8724A', Premarket: '#EFC97A', 'After Hours': '#8B8882',
};
const RATING_COLORS = { A: '#5DCAA5', B: '#85B7EB', C: '#EFC97A', D: '#F09595' };
const COLORS = ['#E8724A','#5DCAA5','#85B7EB','#EFC97A','#F09595','#A78BFA','#34D399','#FB923C'];
const SORT_OPTIONS = [
  { value: 'default',   label: 'Default' },
  { value: 'win_rate',  label: 'Win Rate' },
  { value: 'pnl',       label: 'P&L' },
  { value: 'trades',    label: 'Most Trades' },
  { value: 'followers', label: 'Most Followed' },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#E8724A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff',
      flexShrink: 0, letterSpacing: '-0.5px', userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ── StatBubble ─────────────────────────────────────────────────────────────────
function StatBubble({ label, val, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: color || 'var(--c-text)', letterSpacing: '-0.5px' }}>{val}</p>
      <p style={{ margin: '2px 0 0', fontSize: '9px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</p>
    </div>
  );
}

// ── Trade Activity Card ────────────────────────────────────────────────────────
function TradeActivityCard({ trade: t, traderProfile, onClickTrader }) {
  const isWin  = t.pnl > 0;
  const isLoss = t.pnl < 0;
  const pnlColor = isWin ? '#5DCAA5' : isLoss ? '#E8724A' : 'var(--c-text-2)';
  const isLong   = t.direction === 'Long' || t.direction === 'long';

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: '14px', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {/* Trader row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          onClick={() => onClickTrader && onClickTrader(traderProfile)}
        >
          <Avatar name={traderProfile?.name} color={traderProfile?.avatar_color} size={28} />
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text)' }}>
              {traderProfile?.name || 'Trader'}
            </span>
            {traderProfile?.username && (
              <span style={{ fontSize: '11px', color: '#E8724A', marginLeft: '5px' }}>
                @{traderProfile.username}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>{t.date}</span>
      </div>

      {/* Trade info row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
            background: isLong ? 'rgba(93,202,165,0.1)' : 'rgba(232,114,74,0.1)',
            color: isLong ? '#5DCAA5' : '#E8724A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
          }}>
            {isLong ? '↑' : '↓'}
          </div>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-text)' }}>{t.symbol}</span>
          {t.setup && (
            <span style={{ fontSize: '10px', color: 'var(--c-text-2)', fontStyle: 'italic' }}>· {t.setup}</span>
          )}
          {t.session && (
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
              background: `${SESSION_COLORS[t.session] || '#8B8882'}22`,
              color: SESSION_COLORS[t.session] || '#8B8882',
            }}>
              {t.session}
            </span>
          )}
          {t.rating && (
            <span style={{
              fontSize: '9px', fontWeight: 800, padding: '2px 5px', borderRadius: '6px',
              background: `${RATING_COLORS[t.rating]}22`,
              color: RATING_COLORS[t.rating],
            }}>
              {t.rating}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
            {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            {isWin ? 'WIN' : isLoss ? 'LOSS' : 'B/E'}
          </div>
        </div>
      </div>

      {/* Notes */}
      {t.notes && (
        <p style={{
          margin: 0, fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5,
          borderTop: '1px solid var(--c-border)', paddingTop: '8px',
          fontStyle: 'italic',
        }}>
          "{t.notes}"
        </p>
      )}
    </div>
  );
}

// ── Trader Profile Modal ───────────────────────────────────────────────────────
function TraderProfileModal({ trader: p, trades, loading, isFollowing, onToggleFollow, onClose, followerCount }) {
  const [hov, setHov] = useState(false);
  if (!p) return null;

  const topSetups = useMemo(() => {
    const map = {};
    (trades || []).forEach(t => {
      if (!t.setup) return;
      if (!map[t.setup]) map[t.setup] = { count: 0, wins: 0 };
      map[t.setup].count++;
      if (t.pnl > 0) map[t.setup].wins++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  }, [trades]);

  const topSessions = useMemo(() => {
    const map = {};
    (trades || []).forEach(t => {
      if (!t.session) return;
      if (!map[t.session]) map[t.session] = { count: 0 };
      map[t.session].count++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [trades]);

  const recentTrades = (trades || []).slice(0, 8);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: '20px',
        border: '1px solid var(--c-border)', width: '100%', maxWidth: '480px',
        maxHeight: '88vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar name={p.name} color={p.avatar_color} size={52} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--c-text)' }}>{p.name || 'Trader'}</div>
              {p.username && (
                <div style={{ fontSize: '12px', color: '#E8724A', fontWeight: 600, marginTop: '2px' }}>@{p.username}</div>
              )}
              {followerCount > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '3px' }}>
                  {followerCount} follower{followerCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onMouseEnter={() => setHov(true)}
              onMouseLeave={() => setHov(false)}
              onClick={() => onToggleFollow(p.id)}
              style={{
                background: isFollowing ? 'transparent' : '#E8724A',
                border: isFollowing ? `1px solid ${hov ? '#E24B4A' : 'var(--c-border)'}` : 'none',
                color: isFollowing ? (hov ? '#E24B4A' : 'var(--c-text-2)') : '#17150F',
                padding: '7px 14px', borderRadius: '10px', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {isFollowing ? (hov ? 'Unfollow' : 'Following') : 'Follow'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
          </div>
        </div>

        {/* Bio */}
        {p.bio && (
          <p style={{ margin: '12px 20px 0', fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>{p.bio}</p>
        )}

        {/* Stats strip */}
        <div style={{ margin: '16px 20px 0', display: 'flex', gap: '6px', background: 'var(--c-bg)', borderRadius: '12px', padding: '14px' }}>
          <StatBubble label="Trades" val={p.trade_count ?? '—'} />
          <div style={{ width: '1px', background: 'var(--c-border)' }} />
          <StatBubble label="Win Rate" val={p.win_rate != null ? p.win_rate.toFixed(0) + '%' : '—'} color={p.win_rate >= 50 ? '#5DCAA5' : '#F09595'} />
          <div style={{ width: '1px', background: 'var(--c-border)' }} />
          <StatBubble label="P&L" val={p.total_pnl != null ? fmt(p.total_pnl) : '—'} color={p.total_pnl >= 0 ? '#5DCAA5' : '#F09595'} />
        </div>

        {/* Sessions */}
        {topSessions.length > 0 && (
          <div style={{ margin: '14px 20px 0' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--c-text-2)' }}>Sessions</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {topSessions.map(([sess, v]) => (
                <span key={sess} style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                  background: `${SESSION_COLORS[sess] || '#8B8882'}20`,
                  color: SESSION_COLORS[sess] || '#8B8882',
                  border: `1px solid ${SESSION_COLORS[sess] || '#8B8882'}40`,
                }}>
                  {sess} · {v.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Setups */}
        {topSetups.length > 0 && (
          <div style={{ margin: '14px 20px 0' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--c-text-2)' }}>Favourite Setups</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {topSetups.map(([setup, v]) => (
                <span key={setup} style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                  background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text-2)',
                }}>
                  {setup} · {v.count} ({v.count ? (v.wins / v.count * 100).toFixed(0) : 0}% WR)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent trades */}
        <div style={{ margin: '16px 20px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--c-text-2)' }}>
            Recent Trades
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--c-text-2)', fontSize: '12px' }}>Loading…</div>
          ) : recentTrades.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentTrades.map((t, i) => {
                const pnlColor = t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#E8724A' : 'var(--c-text-2)';
                return (
                  <div key={t.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '10px', background: 'var(--c-bg)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--c-text)' }}>{t.symbol}</span>
                      {t.session && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px',
                          background: `${SESSION_COLORS[t.session] || '#8B8882'}20`,
                          color: SESSION_COLORS[t.session] || '#8B8882',
                        }}>{t.session}</span>
                      )}
                      {t.rating && (
                        <span style={{
                          fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '6px',
                          background: `${RATING_COLORS[t.rating]}20`, color: RATING_COLORS[t.rating],
                        }}>{t.rating}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                        {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--c-text-2)', marginLeft: '8px' }}>{t.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', background: 'var(--c-bg)', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)' }}>
                {p.share_trades ? 'No trades yet.' : "This trader hasn't enabled trade sharing yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Profile Card ───────────────────────────────────────────────────────────────
function ProfileCard({ p, isFollowing, onToggleFollow, isSelf, followerCount, onClickProfile }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="jm-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ cursor: onClickProfile && !isSelf ? 'pointer' : 'default' }}
          onClick={() => onClickProfile && !isSelf && onClickProfile(p)}>
          <Avatar name={p.name} color={p.avatar_color || '#E8724A'} size={46} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p
              style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: onClickProfile && !isSelf ? 'pointer' : 'default' }}
              onClick={() => onClickProfile && !isSelf && onClickProfile(p)}
            >
              {p.name || 'Trader'}
            </p>
            {followerCount > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--c-text-2)', fontWeight: 500 }}>
                {followerCount} follower{followerCount !== 1 ? 's' : ''}
              </span>
            )}
            {p.share_trades && (
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', background: 'rgba(93,202,165,0.1)', color: '#5DCAA5' }}>
                shares trades
              </span>
            )}
          </div>
          {p.username && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#E8724A', fontWeight: 600 }}>@{p.username}</p>
          )}
          {p.bio && (
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {p.bio}
            </p>
          )}
        </div>
        {!isSelf && (
          <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onToggleFollow(p.id)}
            style={{
              background: isFollowing ? 'transparent' : '#E8724A',
              border: isFollowing ? `0.5px solid ${hov ? '#E24B4A' : '#4D4A42'}` : 'none',
              color: isFollowing ? (hov ? '#E24B4A' : 'var(--c-text-2)') : '#17150F',
              padding: '7px 14px', borderRadius: '10px', fontSize: '12px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              flexShrink: 0, transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {isFollowing ? (hov ? 'Unfollow' : 'Following') : 'Follow'}
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '6px', borderTop: '0.5px solid var(--c-border)', paddingTop: '12px' }}>
        <StatBubble label="Trades" val={p.trade_count ?? '—'} />
        <div style={{ width: '0.5px', background: 'var(--c-border)' }} />
        <StatBubble label="Win Rate" val={p.win_rate != null ? p.win_rate.toFixed(0) + '%' : '—'} color={p.win_rate >= 50 ? '#5DCAA5' : '#F09595'} />
        <div style={{ width: '0.5px', background: 'var(--c-border)' }} />
        <StatBubble label="P&L" val={p.total_pnl != null ? fmt(p.total_pnl) : '—'} color={p.total_pnl >= 0 ? '#5DCAA5' : '#F09595'} />
      </div>

      {/* View profile button */}
      {onClickProfile && !isSelf && (
        <button
          onClick={() => onClickProfile(p)}
          style={{
            background: 'var(--c-bg)', border: '1px solid var(--c-border)',
            borderRadius: '8px', padding: '7px', fontSize: '11px',
            fontWeight: 600, color: 'var(--c-text-2)', cursor: 'pointer',
            width: '100%', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,114,74,0.4)'; e.currentTarget.style.color = '#E8724A'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
        >
          View full profile →
        </button>
      )}
    </div>
  );
}

// ── Main Social View ───────────────────────────────────────────────────────────
export default function Social({ user, profile, showToast }) {
  const { trades } = useApp();
  const [tab,        setTab]        = useState('discover');
  const [feedTab,    setFeedTab]    = useState('trades');
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [following,      setFollowing]      = useState([]);
  const [followerCounts, setFollowerCounts] = useState({});
  const [feedTrades,     setFeedTrades]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [dbError,        setDbError]        = useState(false);
  const [search,         setSearch]         = useState('');
  const [sortBy,         setSortBy]         = useState('default');
  const [toggling,       setToggling]       = useState(null);

  // Trader profile modal
  const [selectedTrader,  setSelectedTrader]  = useState(null);
  const [traderTrades,    setTraderTrades]    = useState([]);
  const [loadingTrader,   setLoadingTrader]   = useState(false);

  // My profile state
  const [username,    setUsername]    = useState(profile?.username || '');
  const [bio,         setBio]         = useState(profile?.bio || '');
  const [isPublic,    setIsPublic]    = useState(profile?.is_public ?? false);
  const [shareTrades, setShareTrades] = useState(profile?.share_trades ?? false);
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#E8724A');
  const [profileMsg,  setProfileMsg]  = useState('');
  const [saving,      setSaving]      = useState(false);

  const userId  = user?.id;
  const myStats = computeStats(trades);

  const myCard = useMemo(() => ({
    id: userId,
    name: profile?.name || user?.email || 'You',
    username, bio, avatar_color: avatarColor,
    is_public: isPublic, share_trades: shareTrades,
    trade_count: myStats.count, win_rate: myStats.winRate, total_pnl: myStats.totalPnl,
  }), [profile, user, username, bio, avatarColor, isPublic, shareTrades, myStats]);

  useEffect(() => {
    if (!userId) return;
    loadSocial();
  }, [userId]);

  async function loadSocial() {
    setLoading(true);
    setDbError(false);
    try {
      // Who I follow
      const { data: followData, error: followErr } = await sb
        .from('follows').select('following_id').eq('follower_id', userId);

      if (followErr && (followErr.code === '42P01' || followErr.message?.includes('does not exist'))) {
        setDbError(true); setLoading(false); return;
      }

      const followedIds = (followData || []).map(f => f.following_id);
      setFollowing(followedIds);

      // All public profiles
      const { data: profs, error: profErr } = await sb
        .from('profiles')
        .select('id, name, username, bio, avatar_color, is_public, share_trades, trade_count, win_rate, total_pnl')
        .eq('is_public', true)
        .neq('id', userId);

      if (profErr) throw profErr;
      const profList = profs || [];
      setPublicProfiles(profList);

      // Follower counts
      if (profList.length > 0) {
        const ids = profList.map(p => p.id);
        const { data: counts } = await sb
          .from('follows').select('following_id').in('following_id', ids);
        const countMap = {};
        (counts || []).forEach(row => {
          countMap[row.following_id] = (countMap[row.following_id] || 0) + 1;
        });
        setFollowerCounts(countMap);
      }

      // Trade feed — only from followed traders who share trades
      if (followedIds.length > 0) {
        const sharers = profList
          .filter(p => followedIds.includes(p.id) && p.share_trades)
          .map(p => p.id);
        if (sharers.length > 0) {
          const { data: tFeed } = await sb
            .from('trades')
            .select('id, user_id, date, symbol, direction, pnl, setup, session, rating, notes')
            .in('user_id', sharers)
            .order('date', { ascending: false })
            .limit(60);
          setFeedTrades(tFeed || []);
        } else {
          setFeedTrades([]);
        }
      }
    } catch(e) {
      console.error('Social load error:', e);
    }
    setLoading(false);
  }

  async function handleClickProfile(p) {
    if (!p) return;
    setSelectedTrader(p);
    setTraderTrades([]);
    if (!p.share_trades) return;
    setLoadingTrader(true);
    try {
      const { data } = await sb
        .from('trades')
        .select('id, user_id, date, symbol, direction, pnl, setup, session, rating, notes')
        .eq('user_id', p.id)
        .order('date', { ascending: false })
        .limit(20);
      setTraderTrades(data || []);
    } catch(e) {}
    setLoadingTrader(false);
  }

  async function handleToggleFollow(targetId) {
    setToggling(targetId);
    try {
      if (following.includes(targetId)) {
        await sb.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
        setFollowing(f => f.filter(id => id !== targetId));
        setFollowerCounts(fc => ({ ...fc, [targetId]: Math.max(0, (fc[targetId] || 1) - 1) }));
        showToast('Unfollowed', 'info');
      } else {
        await sb.from('follows').insert({ follower_id: userId, following_id: targetId });
        setFollowing(f => [...f, targetId]);
        setFollowerCounts(fc => { ...fc, [targetId]: (fc[targetId] || 0) + 1 }));
        showToast('Now following!', 'success');
      }
    } catch(e) {
      showToast('Could not update follow', 'error');
    }
    setToggling(null);
    setTimeout(loadSocial, 400);
  }

  async function saveProfile() {
    setSaving(true); setProfileMsg('');
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setProfileMsg('Username must be 3–20 chars, letters / numbers / underscore only.');
      setSaving(false); return;
    }
    const { error } = await sb.from('profiles').update({
      username:     username.trim()  || null,
      bio:          bio.trim()       || null,
      is_public:    isPublic,
      share_trades: shareTrades,
      avatar_color: avatarColor,
      trade_count:  myStats.count,
      win_rate:     myStats.winRate,
      total_pnl:    myStats.totalPnl,
    }).eq('id', userId);

    if (error) {
      if (error.code === '42703') {
        setProfileMsg('Run the social DB migration in Supabase first.');
      } else {
        setProfileMsg(error.message.includes('unique') ? 'That username is already taken.' : error.message);
      }
    } else {
      setProfileMsg('✒ Profile saved');
      showToast('Profile updated', 'success');
      if (isPublic) loadSocial();
      setTimeout(() => setProfileMsg(''), 3000);
    }
    setSaving(false);
  }

  // Enrich feed trades with profile data
  const enrichedFeedTrades = useMemo(() => {
    const profileMap = {;};
    publicProfiles.forEach(p => { profileMap[p.id] = p; });
    return feedTrades.map(t => ({ ...t, _profile: profileMap[t.user_id] }));
  }, [feedTrades, publicProfiles]);

  const feedProfiles = publicProfiles.filter(p => following.includes(p.id));

  const discoverList = useMemo(() => {
    let list = publicProfiles.filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q);
    });
    if (sortBy === 'win_rate')  list = [...list].sort((a, b) => (b.win_rate ?? -1)    - (a.win_rate ?? -1));
    if (sortBy === 'pnl')       list = [...list].sort((a, b) => (b.total_pnl ?? 0)   - (a.total_pnl ?? 0));
    if (sortBy === 'trades')    list = [...list].sort((a, b) => (b.trade_count ?? 0) - (a.trade_count ?? 0));
    if (sortBy === 'followers') list = [...list].sort((a, b) => (followerCounts[b.id] ?? 0) - (followerCounts[a.id] ?? 0));
    return list;
  }, [publicProfiles, search, sortBy, followerCounts]);

  // ── DB Migration error ────────────────────────────────────────────────────
  if (dbError) {
    return (
      <div className="jm-view">
        <div className="jm-greeting">
          <p className="jm-hello">Community</p>
          <h1 className="jm-page-title">Social <span>Hub</span></h1>
        </div>
        <div className="jm-card" style={{ marginTop: '12px', borderColor: 'rgba(232,114,74,0.3)', background: 'rgba(232,114,74,0.06)' }}>
          <p style={{ margin: '0 0 6px', fontSize: '18px' }}>⚙️</p>
          <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>One-time setup needed</p>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
            The Social features need a quick database migration. Run the SQL file in your Supabase SQL Editor, then come back here.
          </p>
          <a href="https://supabase.com/dashboard/project/ppjrfpuqfofgggtgmipd/sql/new" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '9px 18px', borderRadius: '10px', background: '#E8724A', color: '#fff', fontSize: '13px', fontWeight: 600, textDecoration: 'none', marginRight: '8px' }}>
            Open Supabase SQL Editor →
          </a>
          <button className="jm-btn-ghost" style={{ marginTop: '8px', fontSize: '12px' }} onClick={loadSocial}>Retry</button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Community</p>
        <h1 className="jm-page-title">Social <span>Hub</span></h1>
      </div>

      <div className="jm-seg" style={{ marginBottom: '20px' }}>
        {[
          ['feed',     `Feed${feedProfiles.length ? ' · ' + feedProfiles.length : ''}`],
          ['discover', 'Discover'],
          ['profile',  'My Profile'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="view-loading">
          <div className="jm-spinner" style={{ width: '22px', height: '22px', borderWidth: '2.5px' }} />
          <p style={{ fontSize: '13px', color: 'var(--c-text-2)', margin: 0 }}>Loading…</p>
        </div>
      ) : (<>

        {/* ── FEED ─────────────────────────────────────────────────────── */}
        {tab === 'feed' && (
          <div>
            {feedProfiles.length === 0 ? (
              <div className="jm-empty" style={{ paddingTop: '3rem' }}>
                <div className="jm-empty-icon">◈</div>
                <p style={{ fontWeight: 600 }}>Your feed is empty</p>
                <p style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
                  Follow traders in Discover to see their activity here.
                </p>
                <button className="jm-btn" style={{ marginTop: '16px', fontSize: '13px', padding: '10px 24px' }}
                  onClick={() => setTab('discover')}>
                  Discover Traders
                </button>
              </div>
            ) : (
              <>
                {/* Feed sub-tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {[
                    ['trades',  `Trades${enrichedFeedTrades.length ? ' · ' + enrichedFeedTrades.length : ''}`],
                    ['traders', `Traders · ${feedProfiles.length}`],
                  ].map(([id, label]) => (
                    <button key={id}
                      onClick={() => setFeedTab(id)}
                      style={{
                        padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                        background: feedTab === id ? '#E8724A' : 'var(--c-surface)',
                        color: feedTab === id ? '#17150F' : 'var(--c-text-2)',
                        border: feedTab === id ? 'none' : '1px solid var(--c-border)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {feedTab === 'trades' && (
                  enrichedFeedTrades.length === 0 ? (
                    <div className="jm-empty">
                      <div className="jm-empty-icon">📊</div>
                      <p style={{ fontWeight: 600 }}>No shared trades yet</p>
                      <p style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
                        The traders you follow haven't enabled trade sharing yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {enrichedFeedTrades.map((t, i) => (
                        <TradeActivityCard
                          key={t.id || i}
                          trade={t}
                          traderProfile={t._profile}
                          onClickTrader={handleClickProfile}
                        />
                      ))}
                    </div>
                  )
                )}

                {feedTab === 'traders' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {feedProfiles.map(p => (
                      <ProfileCard
                        key={p.id} p={p}
                        isFollowing={true}
                        onToggleFollow={handleToggleFollow}
                        followerCount={followerCounts[p.id] || 0}
                        onClickProfile={handleClickProfile}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── DISCOVER ─────────────────────────────────────────────────── */}
        {tab === 'discover' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
              <input className="jm-in" type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or @handle…"
                style={{ flex: 1, margin: 0 }}
              />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{
                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                  color: 'var(--c-text-2)', borderRadius: '10px', padding: '9px 12px',
                  fontSize: '12px', fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none', flexShrink: 0,
                }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {discoverList.length === 0 ? (
              <div className="jm-empty" style={{ paddingTop: '2rem' }}>
                <div className="jm-empty-icon">◎</div>
                <p style={{ fontWeight: 600 }}>
                  {search ? 'No traders match that search' : 'No public traders yet'}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
                  {search ? 'Try a different name or handle.' : 'Be the first — enable your public profile in My Profile.'}
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'var(--c-text-2)', marginBottom: '14px' }}>
                  {discoverList.length} public trader{discoverList.length !== 1 ? 's' : ''}
                  {following.length > 0 && ` · you follow ${following.filter(id => discoverList.find(p => p.id === id)).length}`}
                </p>
                <div className="social-discover-grid">
                  {discoverList.map(p => (
                    <ProfileCard
                      key={p.id} p={p}
                      isFollowing={following.includes(p.id)}
                      onToggleFollow={handleToggleFollow}
                      followerCount={followerCounts[p.id] || 0}
                      onClickProfile={handleClickProfile}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MY PROFILE ───────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div>
            {/* Preview */}
            <div className="jm-card" style={{ marginBottom: '12px', background: 'radial-gradient(ellipse at top right, rgba(232,114,74,0.1) 0%, transparent 60%), var(--c-surface)' }}>
              <p className="jm-card-title" style={{ marginBottom: '16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--c-text-2)' }}>Preview</p>
              <ProfileCard p={myCard} isFollowing={false} onToggleFollow={() => {}} isSelf />
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: isPublic ? '#5DCAA5' : 'var(--c-border)',
                  boxShadow: isPublic ? '0 0 6px rgba(93,202,165,0.6)' : 'none', flexShrink: 0,
                }} />
                <p style={{ margin: 0, fontSize: '11px', color: isPublic ? '#5DCAA5' : 'var(--c-text-2)', fontWeight: 500 }}>
                  {isPublic ? 'Visible in Discover · Others can find and follow you' : 'Profile is private · Only you can see this'}
                </p>
              </div>
            </div>

            {/* Edit card */}
            <div className="jm-card" style={{ marginBottom: '12px' }}>
              <p className="jm-card-title" style={{ marginBottom: '18px' }}>Edit Profile</p>

              <div className="set-row">
                <label>Username (optional)</label>
                <input className="jm-in" type="text" value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="your_handle" maxLength={20} />
                <p style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '4px' }}>
                  3–20 chars · letters, numbers, underscore
                </p>
              </div>

              <div className="set-row">
                <label>Bio (optional)</label>
                <textarea className="jm-in" value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="ES & NQ futures trader. London session."
                  maxLength={120} rows={2} style={{ minHeight: '58px' }} />
                <p style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '4px' }}>{bio.length}/120</p>
              </div>

              <div className="set-row">
                <label>Avatar colour</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)} style={{
                      width: '30px', height: '30px', borderRadius: '50%', background: c,
                      border: avatarColor === c ? '2.5px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                      boxShadow: avatarColor === c ? `0 0 0 2px ${c}` : 'none',
                    }} />
                  ))}
                </div>
              </div>

              {/* Public profile toggle */}
              <div className="set-row">
                <div className="theme-toggle-row">
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--c-text)', fontWeight: 500 }}>Public profile</span>
                    <p style={{ fontSize: '11px', color: 'var(--c-text-2)', margin: '2px 0 0' }}>
                      Appear in Discover · let others follow you
                    </p>
                  </div>
                  <label className="theme-switch">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                    <span className="theme-track"></span>
                    <span className="theme-thumb"></span>
                  </label>
                </div>
              </div>

              {/* Share trades toggle */}
              <div className="set-row" style={{ marginBottom: 0 }}>
                <div className="theme-toggle-row">
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--c-text)', fontWeight: 500 }}>Share trades publicly</span>
                    <p style={{ fontSize: '11px', color: 'var(--c-text-2)', margin: '2px 0 0' }}>
                      Followers can see your trades in their feed
                    </p>
                  </div>
                  <label className="theme-switch">
                    <input type="checkbox" checked={shareTrades} onChange={e => setShareTrades(e.target.checked)} />
                    <span className="theme-track"></span>
                    <span className="theme-thumb"></span>
                  </label>
                </div>
              </div>
            </div>

            {profileMsg && (
              <p style={{ fontSize: '12px', fontWeight: 600, color: profileMsg.startsWith('✓') ? '#5DCAA5' : '#F09595', marginBottom: '12px' }}>
                {profileMsg}
              </p>
            )}
            <button className="jm-btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        )}

      </>)}

      {/* ── TRADER PROFILE MODAL ─────────────────────────────────────── */}
      {selectedTrader && (
        <TraderProfileModal
          trader={selectedTrader}
          trades={traderTrades}
          loading={loadingTrader}
          isFollowing={following.includes(selectedTrader.id)}
          onToggleFollow={handleToggleFollow}
          followerCount={followerCounts[selectedTrader.id] || 0}
          onClose={() => { setSelectedTrader(null); setTraderTrades([]); }}
        />
      )}
    </div>
  );
}
