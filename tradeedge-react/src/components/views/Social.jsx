import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';
import { computeStats, fmt } from '../../lib/utils';

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
      <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: color || '#F5F3ED', letterSpacing: '-0.5px' }}>{val}</p>
      <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#6B6760', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</p>
    </div>
  );
}

// ── ProfileCard ───────────────────────────────────────────────────────────────
function ProfileCard({ p, isFollowing, onToggleFollow, isSelf, followerCount }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="jm-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeSlideUp 0.3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Avatar name={p.name} color={p.avatar_color || '#E8724A'} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#F5F3ED', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name || 'Trader'}
            </p>
            {followerCount > 0 && (
              <span style={{ fontSize: '10px', color: '#6B6760', fontWeight: 500 }}>
                {followerCount} follower{followerCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {p.username && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#E8724A', fontWeight: 600 }}>@{p.username}</p>
          )}
          {p.bio && (
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#8B8882', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
              color: isFollowing ? (hov ? '#E24B4A' : '#8B8882') : '#17150F',
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
      <div style={{ display: 'flex', gap: '6px', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <StatBubble label="Trades" val={p.trade_count ?? '—'} />
        <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
        <StatBubble label="Win Rate" val={p.win_rate != null ? p.win_rate.toFixed(0) + '%' : '—'} color={p.win_rate >= 50 ? '#5DCAA5' : '#F09595'} />
        <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
        <StatBubble label="P&L" val={p.total_pnl != null ? fmt(p.total_pnl) : '—'} color={p.total_pnl >= 0 ? '#5DCAA5' : '#F09595'} />
      </div>
    </div>
  );
}

// ── Main Social View ───────────────────────────────────────────────────────────
const COLORS = ['#E8724A','#5DCAA5','#85B7EB','#EFC97A','#F09595','#A78BFA','#34D399','#FB923C'];
const SORT_OPTIONS = [
  { value: 'default',   label: 'Default' },
  { value: 'win_rate',  label: 'Win Rate' },
  { value: 'pnl',       label: 'P&L' },
  { value: 'trades',    label: 'Most Trades' },
  { value: 'followers', label: 'Most Followed' },
];

export default function Social({ user, profile, showToast }) {
  const { trades } = useApp();
  const [tab, setTab] = useState('discover');
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [following, setFollowing]           = useState([]); // array of user_ids
  const [followerCounts, setFollowerCounts] = useState({}); // { userId: count }
  const [loading, setLoading]               = useState(true);
  const [dbError, setDbError]               = useState(false); // migration not run yet
  const [search, setSearch]                 = useState('');
  const [sortBy, setSortBy]                 = useState('default');
  const [toggling, setToggling]             = useState(null); // userId being toggled

  // My profile edit state
  const [username,    setUsername]    = useState(profile?.username || '');
  const [bio,         setBio]         = useState(profile?.bio || '');
  const [isPublic,    setIsPublic]    = useState(profile?.is_public || false);
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#E8724A');
  const [profileMsg,  setProfileMsg]  = useState('');
  const [saving,      setSaving]      = useState(false);

  const userId   = user?.id;
  const myStats  = computeStats(trades);

  // Enrich my profile with computed stats for preview
  const myCard = useMemo(() => ({
    id: userId,
    name: profile?.name || user?.email || 'You',
    username,
    bio,
    avatar_color: avatarColor,
    is_public: isPublic,
    trade_count: myStats.count,
    win_rate: myStats.winRate,
    total_pnl: myStats.totalPnl,
  }), [profile, user, username, bio, avatarColor, isPublic, myStats]);

  useEffect(() => {
    if (!userId) return;
    loadSocial();
  }, [userId]);

  async function loadSocial() {
    setLoading(true);
    setDbError(false);
    try {
      // Who I follow
      const { data: followData, error: followErr } = await sb.from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      // If the table doesn't exist yet (migration not run), show helpful message
      if (followErr && (followErr.code === '42P01' || followErr.message?.includes('does not exist'))) {
        setDbError(true);
        setLoading(false);
        return;
      }
      setFollowing((followData || []).map(f => f.following_id));

      // All public profiles (excluding self)
      const { data: profs, error: profErr } = await sb
        .from('profiles')
        .select('id, name, username, bio, avatar_color, is_public, trade_count, win_rate, total_pnl')
        .eq('is_public', true)
        .neq('id', userId);

      if (profErr) throw profErr;
      const profList = profs || [];
      setPublicProfiles(profList);

      // Follower counts for all visible profiles
      if (profList.length > 0) {
        const ids = profList.map(p => p.id);
        const { data: counts } = await sb
          .from('follows')
          .select('following_id')
          .in('following_id', ids);
        const countMap = {};
        (counts || []).forEach(row => {
          countMap[row.following_id] = (countMap[row.following_id] || 0) + 1;
        });
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
      // Snapshot live stats so other users see them without querying trades
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

  // ── Sorted discover list ──────────────────────────────────────────────────
  const feedProfiles = publicProfiles.filter(p => following.includes(p.id));

  const discoverList = useMemo(() => {
    let list = publicProfiles.filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q);
    });
    if (sortBy === 'win_rate')  list = [...list].sort((a, b) => (b.win_rate ?? -1) - (a.win_rate ?? -1));
    if (sortBy === 'pnl')       list = [...list].sort((a, b) => (b.total_pnl ?? 0) - (a.total_pnl ?? 0));
    if (sortBy === 'trades')    list = [...list].sort((a, b) => (b.trade_count ?? 0) - (a.trade_count ?? 0));
    if (sortBy === 'followers') list = [...list].sort((a, b) => (followerCounts[b.id] ?? 0) - (followerCounts[a.id] ?? 0));
    return list;
  }, [publicProfiles, search, sortBy, followerCounts]);

  // ── DB Migration prompt ─────────────────────────────────────────────────────
  if (dbError) {
    return (
      <div className="jm-view">
        <div className="jm-greeting">
          <p className="jm-hello">Community</p>
          <h1 className="jm-page-title">Social <span>Hub</span></h1>
        </div>
        <div className="jm-card" style={{ marginTop: '12px', borderColor: 'rgba(232,114,74,0.3)', background: 'rgba(232,114,74,0.06)' }}>
          <p style={{ margin: '0 0 6px', fontSize: '18px' }}>⚙️</p>
          <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#F5F3ED' }}>One-time setup needed</p>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#8B8882', lineHeight: 1.6 }}>
            The Social features need a quick database migration. Run the SQL file in your Supabase SQL Editor, then come back here.
          </p>
          <a
            href="https://supabase.com/dashboard/project/ppjrfpuqfofgggtgmipd/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '9px 18px', borderRadius: '10px',
              background: '#E8724A', color: '#fff', fontSize: '13px',
              fontWeight: 600, textDecoration: 'none', marginRight: '8px',
            }}
          >
            Open Supabase SQL Editor →
          </a>
          <button
            className="jm-btn-ghost"
            style={{ marginTop: '8px', fontSize: '12px' }}
            onClick={loadSocial}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <p style={{ fontSize: '13px', color: '#6B6862', margin: 0 }}>Loading…</p>
        </div>
      ) : (<>

        {/* ── FEED ─────────────────────────────────────────────────────── */}
        {tab === 'feed' && (
          <div>
            {feedProfiles.length === 0 ? (
              <div className="jm-empty" style={{ paddingTop: '3rem' }}>
                <div className="jm-empty-icon">◈</div>
                <p style={{ fontWeight: 600 }}>Your feed is empty</p>
                <p style={{ fontSize: '13px', color: '#6B6862', lineHeight: 1.6 }}>
                  Follow other traders in Discover to see<br />their stats and activity here.
                </p>
                <button className="jm-btn" style={{ marginTop: '16px', fontSize: '13px', padding: '10px 24px' }} onClick={() => setTab('discover')}>
                  Discover Traders
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: '#6B6760', marginBottom: '14px' }}>
                  {feedProfiles.length} trader{feedProfiles.length !== 1 ? 's' : ''} you follow
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {feedProfiles.map(p => (
                    <ProfileCard
                      key={p.id} p={p}
                      isFollowing={true}
                      onToggleFollow={handleToggleFollow}
                      followerCount={followerCounts[p.id] || 0}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DISCOVER ─────────────────────────────────────────────────── */}
        {tab === 'discover' && (
          <div>
            {/* Search + Sort row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
              <input
                className="jm-in"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or @handle…"
                style={{ flex: 1, margin: 0 }}
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                  color: 'var(--c-text-2)', borderRadius: '10px', padding: '9px 12px',
                  fontSize: '12px', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  outline: 'none', flexShrink: 0,
                }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {discoverList.length === 0 ? (
              <div className="jm-empty" style={{ paddingTop: '2rem' }}>
                <div className="jm-empty-icon">◎</div>
                <p style={{ fontWeight: 600 }}>
                  {search ? 'No traders match that search' : 'No public traders yet'}
                </p>
                <p style={{ fontSize: '13px', color: '#6B6862', lineHeight: 1.6 }}>
                  {search
                    ? 'Try a different name or handle.'
                    : 'Be the first — enable your public profile in My Profile.'}
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: '#6B6760', marginBottom: '14px' }}>
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
            {/* Live preview */}
            <div className="jm-card" style={{ marginBottom: '12px', background: 'radial-gradient(ellipse at top right, rgba(232,114,74,0.1) 0%, transparent 60%), var(--c-surface)' }}>
              <p className="jm-card-title" style={{ marginBottom: '16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6760' }}>Preview</p>
              <ProfileCard p={myCard} isFollowing={false} onToggleFollow={() => {}} isSelf />
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPublic ? '#5DCAA5' : '#4D4A42', boxShadow: isPublic ? '0 0 6px rgba(93,202,165,0.6)' : 'none', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '11px', color: isPublic ? '#5DCAA5' : '#6B6760', fontWeight: 500 }}>
                  {isPublic ? 'Visible in Discover · Other traders can find and follow you' : 'Profile is private · Only you can see this'}
                </p>
              </div>
            </div>

            {/* Edit card */}
            <div className="jm-card" style={{ marginBottom: '12px' }}>
              <p className="jm-card-title" style={{ marginBottom: '18px' }}>Edit Profile</p>

              <div className="set-row">
                <label>Username (optional)</label>
                <input
                  className="jm-in" type="text" value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="your_handle" maxLength={20}
                />
                <p style={{ fontSize: '11px', color: '#6B6760', marginTop: '4px' }}>
                  3–20 chars · letters, numbers, underscore
                </p>
              </div>

              <div className="set-row">
                <label>Bio (optional)</label>
                <textarea
                  className="jm-in" value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="ES & NQ futures trader. London session."
                  maxLength={120} rows={2}
                  style={{ minHeight: '58px' }}
                />
                <p style={{ fontSize: '11px', color: '#6B6760', marginTop: '4px' }}>{bio.length}/120</p>
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

              <div className="set-row" style={{ marginBottom: 0 }}>
                <div className="theme-toggle-row">
                  <div>
                    <span style={{ fontSize: '13px', color: '#C8C4BC', fontWeight: 500 }}>Public profile</span>
                    <p style={{ fontSize: '11px', color: '#6B6862', margin: '2px 0 0' }}>
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
    </div>
  );
}
