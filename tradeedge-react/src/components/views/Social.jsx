import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';
import { computeStats, fmt } from '../../lib/utils';

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, color, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || 'var(--c-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: '#fff',
      flexShrink: 0, letterSpacing: '-0.5px', userSelect: 'none',
      fontFamily: "'Inter', sans-serif",
    }}>
      {initials}
    </div>
  );
}

function StatBubble({ label, val, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ margin: 0, fontSize: 15, fontWeight: 700, color: color || 'var(--c-text)', letterSpacing: '-0.5px', fontFamily: "'Inter', sans-serif" }}>{val}</div>
      <div style={{ margin: '3px 0 0', fontSize: 9, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ProfileCard({ p, isFollowing, onToggleFollow, isSelf, followerCount }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      border: '1px solid var(--c-border)', borderRadius: 14, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={p.name} color={p.avatar_color || 'var(--c-accent)'} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name || 'Trader'}
            </div>
            {followerCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--c-text-2)' }}>
                {followerCount} follower{followerCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {p.username && (
            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--c-accent)', fontWeight: 600 }}>@{p.username}</div>
          )}
          {p.bio && (
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {p.bio}
            </div>
          )}
        </div>
        {!isSelf && (
          <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onToggleFollow(p.id)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s', whiteSpace: 'nowrap',
              fontFamily: "'Inter', sans-serif",
              background: isFollowing ? 'transparent' : 'var(--c-accent)',
              border: isFollowing ? `1px solid ${hov ? '#C65A45' : 'var(--c-border)'}` : 'none',
              color: isFollowing ? (hov ? '#C65A45' : 'var(--c-text-2)') : '#17150F',
            }}
          >
            {isFollowing ? (hov ? 'Unfollow' : 'Following') : 'Follow'}
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
        <StatBubble label="Trades" val={p.trade_count ?? '—'} />
        <div style={{ width: 1, background: 'var(--c-border)' }} />
        <StatBubble label="Win Rate" val={p.win_rate != null ? p.win_rate.toFixed(0) + '%' : '—'} color={p.win_rate >= 50 ? 'var(--c-accent)' : '#C65A45'} />
        <div style={{ width: 1, background: 'var(--c-border)' }} />
        <StatBubble label="P&L" val={p.total_pnl != null ? fmt(p.total_pnl) : '—'} color={p.total_pnl >= 0 ? 'var(--c-accent)' : '#C65A45'} />
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '24px 0' }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ['#E07A3B','#C65A45','#A89687','#EFC97A','#A78BFA','#34D399','#60A5FA','#FB923C'];

const SORT_OPTIONS = [
  { value: 'default',   label: 'Default' },
  { value: 'win_rate',  label: 'Win Rate' },
  { value: 'pnl',       label: 'P&L' },
  { value: 'trades',    label: 'Most Trades' },
  { value: 'followers', label: 'Most Followed' },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: 'var(--c-text)',
  fontFamily: "'Inter', sans-serif", outline: 'none',
};

// ── Main view ─────────────────────────────────────────────────────────────────

export default function Social({ user, profile, showToast }) {
  const { trades } = useApp();
  const [tab, setTab]                   = useState('discover');
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [following, setFollowing]           = useState([]);
  const [followerCounts, setFollowerCounts] = useState({});
  const [loading, setLoading]               = useState(true);
  const [dbError, setDbError]               = useState(false);
  const [search, setSearch]                 = useState('');
  const [sortBy, setSortBy]                 = useState('default');
  const [toggling, setToggling]             = useState(null);

  // My profile edit state
  const [username,    setUsername]    = useState(profile?.username    || '');
  const [bio,         setBio]         = useState(profile?.bio         || '');
  const [isPublic,    setIsPublic]    = useState(profile?.is_public   || false);
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#E07A3B');
  const [profileMsg,  setProfileMsg]  = useState('');
  const [saving,      setSaving]      = useState(false);

  const userId  = user?.id;
  const myStats = computeStats(trades);

  const myCard = useMemo(() => ({
    id: userId,
    name: profile?.name || user?.email || 'You',
    username, bio, avatar_color: avatarColor, is_public: isPublic,
    trade_count: myStats.count, win_rate: myStats.winRate, total_pnl: myStats.totalPnl,
  }), [profile, user, username, bio, avatarColor, isPublic, myStats]);

  useEffect(() => {
    if (!userId) return;
    loadSocial();
  }, [userId]);

  async function loadSocial() {
    setLoading(true);
    setDbError(false);
    try {
      const { data: followData, error: followErr } = await sb.from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followErr && (followErr.code === '42P01' || followErr.message?.includes('does not exist'))) {
        setDbError(true);
        setLoading(false);
        return;
      }
      setFollowing((followData || []).map(f => f.following_id));

      const { data: profs, error: profErr } = await sb
        .from('profiles')
        .select('id, name, username, bio, avatar_color, is_public, trade_count, win_rate, total_pnl')
        .eq('is_public', true)
        .neq('id', userId);

      if (profErr) throw profErr;
      const profList = profs || [];
      setPublicProfiles(profList);

      if (profList.length > 0) {
        const ids = profList.map(p => p.id);
        const { data: counts } = await sb.from('follows').select('following_id').in('following_id', ids);
        const countMap = {};
        (counts || []).forEach(row => { countMap[row.following_id] = (countMap[row.following_id] || 0) + 1; });
        setFollowerCounts(countMap);
      }
    } catch (e) {
      console.error('Social load error:', e);
    }
    setLoading(false);
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
        setFollowerCounts(fc => ({ ...fc, [targetId]: (fc[targetId] || 0) + 1 }));
        showToast('Now following!', 'success');
      }
    } catch (e) {
      showToast('Could not update follow', 'error');
    }
    setToggling(null);
  }

  async function saveProfile() {
    setSaving(true);
    setProfileMsg('');
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setProfileMsg('Username must be 3–20 chars, letters / numbers / underscore only.');
      setSaving(false);
      return;
    }
    const { error } = await sb.from('profiles').update({
      username: username.trim() || null,
      bio:      bio.trim()      || null,
      is_public: isPublic,
      avatar_color: avatarColor,
      trade_count: myStats.count,
      win_rate:    myStats.winRate,
      total_pnl:   myStats.totalPnl,
    }).eq('id', userId);

    if (error) {
      if (error.code === '42703') {
        setProfileMsg('Run the social DB migration in Supabase first — see the SQL file.');
      } else {
        setProfileMsg(error.message.includes('unique') ? 'That username is already taken.' : error.message);
      }
    } else {
      setProfileMsg('✓ Profile saved');
      showToast('Profile updated', 'success');
      if (isPublic) loadSocial();
      setTimeout(() => setProfileMsg(''), 3000);
    }
    setSaving(false);
  }

  const feedProfiles  = publicProfiles.filter(p => following.includes(p.id));
  const discoverList  = useMemo(() => {
    let list = publicProfiles.filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q);
    });
    if (sortBy === 'win_rate')  list = [...list].sort((a, b) => (b.win_rate ?? -1)     - (a.win_rate ?? -1));
    if (sortBy === 'pnl')       list = [...list].sort((a, b) => (b.total_pnl ?? 0)     - (a.total_pnl ?? 0));
    if (sortBy === 'trades')    list = [...list].sort((a, b) => (b.trade_count ?? 0)   - (a.trade_count ?? 0));
    if (sortBy === 'followers') list = [...list].sort((a, b) => (followerCounts[b.id] ?? 0) - (followerCounts[a.id] ?? 0));
    return list;
  }, [publicProfiles, search, sortBy, followerCounts]);

  // ── DB error state ──────────────────────────────────────────────────────────
  if (dbError) {
    return (
      <div style={{ padding: '36px 44px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Community</div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
            Social <em style={{ color: 'var(--c-accent)', fontStyle: 'italic' }}>Hub</em><span style={{ color: 'var(--c-accent)' }}>.</span>
          </div>
        </div>
        <div style={{ padding: '20px 22px', border: '1px solid rgba(224,122,59,0.3)', borderRadius: 14, background: 'rgba(224,122,59,0.04)' }}>
          <div style={{ fontSize: 20, marginBottom: 10 }}>⚙️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 }}>One-time setup needed</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.7, marginBottom: 16 }}>
            The Social features need a quick database migration. Run the SQL file in your Supabase SQL Editor, then come back here.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="https://supabase.com/dashboard/project/ppjrfpuqfofgggtgmipd/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '9px 18px', borderRadius: 8,
                background: 'var(--c-accent)', color: '#fff',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Open Supabase SQL Editor →
            </a>
            <button
              onClick={loadSocial}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'transparent', border: '1px solid var(--c-border)',
                color: 'var(--c-text-2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '36px 44px', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          Community
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
          Social <em style={{ color: 'var(--c-accent)', fontStyle: 'italic' }}>Hub</em><span style={{ color: 'var(--c-accent)' }}>.</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {[
          ['feed',    `Feed${feedProfiles.length ? ' · ' + feedProfiles.length : ''}`],
          ['discover','Discover'],
          ['profile', 'My Profile'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              background: tab === id ? 'var(--c-accent)' : 'transparent',
              border: tab === id ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
              color: tab === id ? '#17150F' : 'var(--c-text-2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: 'var(--c-text-2)' }}>
          <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid var(--c-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : (
        <>
          {/* ── FEED ── */}
          {tab === 'feed' && (
            <div>
              {feedProfiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--c-text-2)' }}>
                  <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◈</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 8 }}>Your feed is empty</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7 }}>Follow other traders in Discover to see their stats and activity here.</div>
                  <button
                    onClick={() => setTab('discover')}
                    style={{
                      marginTop: 20, padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
                      color: 'var(--c-accent)', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Discover Traders
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 16 }}>
                    {feedProfiles.length} trader{feedProfiles.length !== 1 ? 's' : ''} you follow
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {feedProfiles.map(p => (
                      <ProfileCard key={p.id} p={p} isFollowing onToggleFollow={handleToggleFollow} followerCount={followerCounts[p.id] || 0} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── DISCOVER ── */}
          {tab === 'discover' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or @handle…"
                />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{
                    background: 'transparent', border: '1px solid var(--c-border)',
                    color: 'var(--c-text-2)', borderRadius: 8, padding: '9px 12px',
                    fontSize: 12, fontFamily: "'Inter', sans-serif", cursor: 'pointer',
                    outline: 'none', flexShrink: 0,
                  }}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {discoverList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--c-text-2)' }}>
                  <div style={{ fontSize: 28, marginBottom: 14, opacity: 0.3 }}>◎</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
                    {search ? 'No traders match that search' : 'No public traders yet'}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    {search ? 'Try a different name or handle.' : 'Be the first — enable your public profile in My Profile.'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 16 }}>
                    {discoverList.length} public trader{discoverList.length !== 1 ? 's' : ''}
                    {following.length > 0 && ` · you follow ${following.filter(id => discoverList.find(p => p.id === id)).length}`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {discoverList.map(p => (
                      <ProfileCard
                        key={p.id} p={p}
                        isFollowing={following.includes(p.id)}
                        onToggleFollow={handleToggleFollow}
                        followerCount={followerCounts[p.id] || 0}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── MY PROFILE ── */}
          {tab === 'profile' && (
            <div>
              {/* Preview card */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: 14, padding: '18px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Preview</div>
                <ProfileCard p={myCard} isFollowing={false} onToggleFollow={() => {}} isSelf />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: isPublic ? 'var(--c-accent)' : 'var(--c-text-2)',
                    boxShadow: isPublic ? '0 0 5px var(--c-accent)' : 'none',
                  }} />
                  <div style={{ fontSize: 11, color: isPublic ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
                    {isPublic ? 'Visible in Discover · Other traders can find and follow you' : 'Profile is private · Only you can see this'}
                  </div>
                </div>
              </div>

              {/* Edit form */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 20 }}>Edit profile</div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Username (optional)</div>
                  <input
                    style={inputStyle}
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="your_handle"
                    maxLength={20}
                  />
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 4, opacity: 0.7 }}>3–20 chars · letters, numbers, underscore</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Bio (optional)</div>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 56, lineHeight: 1.6 }}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="ES & NQ futures trader. London session."
                    maxLength={120}
                    rows={2}
                  />
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 4, opacity: 0.7 }}>{bio.length}/120</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Avatar colour</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: avatarColor === c ? '2.5px solid var(--c-text)' : '2px solid transparent',
                          outline: avatarColor === c ? `3px solid ${c}55` : 'none',
                          transition: 'all 0.15s',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Public toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', marginBottom: 3 }}>Public profile</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>Appear in Discover · let others follow you</div>
                  </div>
                  {/* Pill toggle */}
                  <div
                    onClick={() => setIsPublic(p => !p)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                      background: isPublic ? 'var(--c-accent)' : 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--c-border)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: isPublic ? 22 : 2,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div style={{
                  fontSize: 12, fontWeight: 600, marginBottom: 12,
                  color: profileMsg.startsWith('✓') ? 'var(--c-accent)' : '#C65A45',
                }}>
                  {profileMsg}
                </div>
              )}
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
                  color: 'var(--c-accent)', cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1, fontFamily: "'Inter', sans-serif", transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
