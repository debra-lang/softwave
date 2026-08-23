/* Find My Quiet Sound — optional accounts + cloud sync (Phase 1; no billing, no paywalls).
   Local-first: anonymous users never touch the network. This whole layer is INERT unless
   cloud-config.js contains a Supabase URL + anon (publishable) key. When active:
   - Sign in = email magic link (managed by Supabase Auth; sessions per provider defaults).
   - Signed-in users keep working from localStorage; changes are queued and pushed
     (debounced, idle-time) and pulled on start. Newest updated_at wins per record; unknown
     records are kept on both sides. Data loss is treated as worse than duplication.
   - Entitlement authority for signed-in users comes from the server (/me + read-only
     billing row). The client can render it but cannot write it. Launch all-access still
     grants everything to everyone.
   - Audio has priority: sync is debounced, off the interaction path, and never touches audio. */
(function () {
  'use strict';
  const CFG = window.SOFTWAVE_CLOUD || {};
  const ACTIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const $ = (s, r = document) => r.querySelector(s);
  const nowIso = () => new Date().toISOString();
  const LS = { get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } }, del(k) { try { localStorage.removeItem('softwave:' + k); } catch (_) { } } };

  // What syncs (and what deliberately does not: tinnitus-match result, playcounts, metrics, proto:*, dev:plan)
  const ITEM_KEYS = { 'lab:sounds': 'sound', 'mixes': 'mix', 'combos': 'environment' };
  const STATE_KEYS = { 'lab:prefs2': 'profile', 'lab:feedback': 'feedback', 'lab:favs': 'favs', 'lab:spatial': 'spatial' };
  const SETTINGS_FIELDS = ['theme', 'motion', 'visual', 'master'];
  const status = { state: 'local', detail: '' };   // local | syncing | synced | offline | error
  let sb = null, session = null, dirty = LS.get('cloud:dirty', {}), pushTimer = null, ui = {};

  function setStatus(s, detail) { status.state = s; status.detail = detail || ''; const el = $('#acct-sync'); if (el) el.textContent = ({ local: 'Saved on this device', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline — saved locally', error: 'Sync error — saved locally' })[s] + (detail ? ' · ' + detail : ''); }
  function toast(m) { window.softwaveApp && softwaveApp.toast ? softwaveApp.toast(m, 3200) : console.log(m); }
  const track = e => window.softwaveMonetization && softwaveMonetization.track(e);

  // ---------- inert mode ----------
  window.softwaveCloud = { active: ACTIVE, status, signedIn: () => !!session, open: () => { }, exportData, _merge: mergeItems, _ensureIds: ensureIds };
  if (!ACTIVE) return;   // pure local-first: no SDK load, no network, no UI

  // ---------- lazy SDK ----------
  let sdkP = null;
  function sdk() { return sdkP || (sdkP = import('https://esm.sh/@supabase/supabase-js@2').then(m => { sb = m.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY); return sb; })); }

  // ---------- change tracking: wrap localStorage.setItem once ----------
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) { origSet(k, v); try { const key = k.replace(/^softwave:/, ''); if (k.startsWith('softwave:') && (ITEM_KEYS[key] || STATE_KEYS[key] || SETTINGS_FIELDS.includes(key) || key.startsWith('lab:settings:'))) { dirty[key] = nowIso(); LS.set('cloud:dirty', dirty); schedulePush(); } } catch (_) { } };
  function schedulePush() { if (!session) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => push().catch(() => { }), 4000); }
  addEventListener('online', () => { if (session) push().catch(() => { }); });

  // ---------- merge helpers (timestamps; loss is worse than duplication) ----------
  function ensureIds(arr) { let changed = false; (arr || []).forEach(o => { if (o && !o._cid) { o._cid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); o._updated = o._updated || nowIso(); changed = true; } }); return changed; }
  function mergeItems(localArr, cloudRows) {
    const out = []; const byId = new Map();
    (localArr || []).forEach(o => { if (o) byId.set(o._cid, { local: o }); });
    (cloudRows || []).forEach(r => { const e = byId.get(r.id) || {}; e.cloud = r; byId.set(r.id, e); });
    const pushUp = [], writeLocal = [];
    byId.forEach((e, id) => {
      if (e.local && e.cloud) { const lu = Date.parse(e.local._updated || 0), cu = Date.parse(e.cloud.updated_at || 0); if (lu > cu) { out.push(e.local); pushUp.push(e.local); } else { const o = Object.assign({}, e.cloud.data, { _cid: id, _updated: e.cloud.updated_at }); out.push(o); } }
      else if (e.local) { out.push(e.local); pushUp.push(e.local); }
      else { const o = Object.assign({}, e.cloud.data, { _cid: id, _updated: e.cloud.updated_at }); out.push(o); }
    });
    return { merged: out, pushUp };
  }

  // ---------- pull / push ----------
  async function pull() {
    setStatus('syncing'); const uid = session.user.id;
    const { data: rows, error } = await sb.from('user_items').select('*').eq('user_id', uid); if (error) throw error;
    for (const [key, kind] of Object.entries(ITEM_KEYS)) {
      const local = LS.get(key, []); ensureIds(local);
      const { merged, pushUp } = mergeItems(local, rows.filter(r => r.kind === kind));
      LS.set(key, merged);
      for (const o of pushUp) await upsertItem(kind, o);
    }
    const { data: states, error: e2 } = await sb.from('user_state').select('*').eq('user_id', uid); if (e2) throw e2;
    for (const [key, skey] of Object.entries(STATE_KEYS)) {
      const cloud = (states || []).find(s => s.key === skey); const localTs = dirty[key] || '1970';
      if (cloud && (!LS.get(key, null) || Date.parse(cloud.updated_at) > Date.parse(localTs))) LS.set(key, cloud.data);
      else if (LS.get(key, null) != null) await upsertState(skey, LS.get(key, null));
    }
    const cloudSettings = (states || []).find(s => s.key === 'settings');
    if (cloudSettings) { for (const f of SETTINGS_FIELDS) if (cloudSettings.data[f] != null && LS.get(f, null) == null) LS.set(f, cloudSettings.data[f]); }
    setStatus('synced'); track('sync_completed');
    document.dispatchEvent(new CustomEvent('softwave:profile'));
    if (window.softwaveApp && softwaveApp.renderPresetsRemount) softwaveApp.renderPresetsRemount();
  }
  async function upsertItem(kind, o) { const uid = session.user.id; const data = Object.assign({}, o); delete data._cid; delete data._updated; const { error } = await sb.from('user_items').upsert({ id: o._cid, user_id: uid, kind, name: o.name || '', data, updated_at: o._updated || nowIso() }); if (error) throw error; }
  async function upsertState(skey, data) { const { error } = await sb.from('user_state').upsert({ user_id: session.user.id, key: skey, data, updated_at: nowIso() }); if (error) throw error; }
  async function push() {
    if (!session) return; if (!navigator.onLine) { setStatus('offline'); return; }
    try {
      setStatus('syncing'); const d = Object.assign({}, dirty);
      for (const key of Object.keys(d)) {
        if (ITEM_KEYS[key]) { const arr = LS.get(key, []); ensureIds(arr); LS.set(key, arr); for (const o of arr) { o._updated = o._updated || d[key]; await upsertItem(ITEM_KEYS[key], o); }
          const ids = arr.map(o => o._cid); const { data: rows } = await sb.from('user_items').select('id').eq('user_id', session.user.id).eq('kind', ITEM_KEYS[key]); for (const r of rows || []) if (!ids.includes(r.id)) await sb.from('user_items').delete().eq('id', r.id).eq('user_id', session.user.id); }
        else if (STATE_KEYS[key]) { const v = LS.get(key, null); if (v != null) await upsertState(STATE_KEYS[key], v); }
        else { const s = {}; SETTINGS_FIELDS.forEach(f => { const v = LS.get(f, null); if (v != null) s[f] = v; }); await upsertState('settings', s); }
        delete dirty[key]; LS.set('cloud:dirty', dirty);
      }
      setStatus('synced'); track('sync_completed');
    } catch (e) { console.warn('sync', e); setStatus(navigator.onLine ? 'error' : 'offline'); track('sync_failed'); }
  }

  // ---------- server-authoritative entitlements ----------
  async function refreshServerState() {
    try {
      const { data: billing } = await sb.from('billing').select('plan,subscription_state,current_period_end').eq('user_id', session.user.id).maybeSingle();
      if (window.softwaveMonetization && softwaveMonetization.setServerState) softwaveMonetization.setServerState(billing ? { plan: billing.plan, state: billing.subscription_state, periodEnd: billing.current_period_end, source: 'server' } : { plan: 'free', state: 'none', source: 'server' });
    } catch (_) { }
  }

  // ---------- migration on first sign-in ----------
  async function offerMigration() {
    const hasLocal = ['lab:sounds', 'mixes', 'combos', 'lab:prefs2', 'lab:feedback', 'lab:favs'].some(k => { const v = LS.get(k, null); return v && (Array.isArray(v) ? v.length : Object.keys(v).length); });
    if (!hasLocal || LS.get('cloud:migrated:' + session.user.id, false)) { await pull(); return; }
    const ok = confirm('Save your current Find My Quiet Sound data to your account?\n\nWe’ll add your saved sounds, preferences and experiments to your account so they follow you across devices. Nothing is deleted from this device.');
    if (ok) { Object.keys(ITEM_KEYS).concat(Object.keys(STATE_KEYS)).forEach(k => { dirty[k] = nowIso(); }); dirty['settings'] = nowIso(); LS.set('cloud:dirty', dirty); await push(); await pull(); LS.set('cloud:migrated:' + session.user.id, true); toast('Your data is saved to your account.'); track('local_data_migrated'); }
    else { await pull(); }
  }

  // ---------- export / delete ----------
  function exportData() {
    const out = { exported_at: nowIso(), app: 'Find My Quiet Sound' };
    Object.keys(ITEM_KEYS).concat(Object.keys(STATE_KEYS)).concat(SETTINGS_FIELDS).forEach(k => { const v = LS.get(k, null); if (v != null) out[k] = v; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = 'find-my-quiet-sound-data.json'; a.click();
  }
  async function deleteAccount() {
    if (!confirm('Delete your account and all cloud data? This cannot be undone.')) return;
    const alsoLocal = confirm('Also remove the saved data on THIS device?\n\nOK = remove local data too.\nCancel = keep everything on this device (only the cloud copy is deleted).');
    try {
      const uid = session.user.id;
      await sb.from('user_items').delete().eq('user_id', uid); await sb.from('user_state').delete().eq('user_id', uid); await sb.from('profiles').delete().eq('user_id', uid);
      // Auth-user removal requires the service role; Phase 1 documents this: the account record is emptied and sign-in disabled by user request via support. (Full auth deletion arrives with the Phase 2 backend.)
      if (alsoLocal) { Object.keys(ITEM_KEYS).concat(Object.keys(STATE_KEYS)).forEach(k => LS.del(k)); }
      await sb.auth.signOut(); toast('Cloud data deleted.' + (alsoLocal ? ' Local data removed.' : ' Your local data is untouched.'));
    } catch (e) { toast('Could not delete right now — saved locally, try again later.'); }
  }

  // ---------- minimal account UI (header pill + sheet) ----------
  function mountUI() {
    const right = $('.topbar .top-actions') || $('.topbar');
    const pill = document.createElement('button'); pill.id = 'acct-pill'; pill.className = 'btn btn-ghost btn-sm acct-pill'; pill.textContent = 'Sign in'; right && right.appendChild(pill);
    const sheet = document.createElement('div'); sheet.id = 'acct-sheet'; sheet.hidden = true; sheet.innerHTML = `
      <div class="acct-card" role="dialog" aria-modal="true" aria-label="Account">
        <button class="btn btn-ghost btn-sm" id="acct-close">Close</button>
        <div id="acct-out">
          <h2>Save &amp; sync</h2>
          <p class="muted small">Optional. Keep your saved sounds, Sound Profile and environments across devices. Find My Quiet Sound works fully without an account.</p>
          <label class="sr-only" for="acct-email">Email</label>
          <div class="acct-row"><input id="acct-email" type="email" autocomplete="email" placeholder="you@example.com"><button class="btn btn-primary btn-sm" id="acct-send">Email me a sign-in link</button></div>
          <p class="muted small" id="acct-msg"></p>
        </div>
        <div id="acct-in" hidden>
          <h2>Account</h2>
          <p class="muted small" id="acct-email-show"></p>
          <p class="small" id="acct-sync">Saved on this device</p>
          <div class="acct-row wrap">
            <button class="btn btn-secondary btn-sm" id="acct-syncnow">Sync now</button>
            <button class="btn btn-ghost btn-sm" id="acct-export">Export my data</button>
            <button class="btn btn-ghost btn-sm" id="acct-signout">Sign out</button>
            <button class="btn btn-ghost btn-sm danger" id="acct-delete">Delete account</button>
          </div>
          <p class="muted small">Your data stays on this device too. Subscription management will appear here only if paid plans ever launch.</p>
        </div>
      </div>`;
    document.body.appendChild(sheet); ui = { pill, sheet };
    const open = () => { sheet.hidden = false; }; const close = () => { sheet.hidden = true; };
    pill.addEventListener('click', open); $('#acct-close').addEventListener('click', close); sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });
    $('#acct-send').addEventListener('click', async () => { const email = $('#acct-email').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#acct-msg').textContent = 'Please enter a valid email address.'; return; } $('#acct-msg').textContent = 'Sending…'; try { await sdk(); const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }); if (error) throw error; $('#acct-msg').textContent = 'Check your email — the sign-in link brings you back here.'; } catch (e) { $('#acct-msg').textContent = 'Could not send the link right now. Your data stays saved on this device.'; } });
    $('#acct-syncnow').addEventListener('click', () => { Object.keys(ITEM_KEYS).concat(Object.keys(STATE_KEYS)).forEach(k => dirty[k] = nowIso()); dirty['settings'] = nowIso(); LS.set('cloud:dirty', dirty); push().then(pull).catch(() => { }); });
    $('#acct-export').addEventListener('click', exportData);
    $('#acct-signout').addEventListener('click', async () => { await sb.auth.signOut(); });
    $('#acct-delete').addEventListener('click', deleteAccount);
    window.softwaveCloud.open = open;
  }
  function renderAuth() {
    const signedIn = !!session;
    if (ui.pill) ui.pill.textContent = signedIn ? 'Account' : 'Sign in';
    const out = $('#acct-out'), inn = $('#acct-in'); if (out) out.hidden = signedIn; if (inn) inn.hidden = !signedIn;
    if (signedIn) { $('#acct-email-show').textContent = session.user.email || session.user.id; setStatus(status.state === 'local' ? 'synced' : status.state); }
  }

  // ---------- boot (async; never blocks the app or audio) ----------
  addEventListener('load', () => { setTimeout(async () => {
    try {
      mountUI();
      // Only hit the network if a session might exist or the user opens the sheet.
      const hasToken = Object.keys(localStorage).some(k => k.startsWith('sb-')); const hash = location.hash.includes('access_token') || location.search.includes('code=');
      if (hasToken || hash) {
        await sdk();
        sb.auth.onAuthStateChange(async (_e, s) => { const was = !!session; session = s; renderAuth(); if (s && !was) { track('signed_in'); await sb.from('profiles').upsert({ user_id: s.user.id, updated_at: nowIso() }); await refreshServerState(); await offerMigration(); } if (!s && window.softwaveMonetization && softwaveMonetization.setServerState) softwaveMonetization.setServerState(null); });
        const { data } = await sb.auth.getSession(); session = data.session; renderAuth(); if (session) { await refreshServerState(); await pull().catch(() => setStatus('error')); }
      } else {
        // lazy: load the SDK only when the user opens the account sheet
        ui.pill.addEventListener('click', () => { sdk().then(() => { sb.auth.onAuthStateChange(async (_e, s) => { const was = !!session; session = s; renderAuth(); if (s && !was) { track('signed_in'); await sb.from('profiles').upsert({ user_id: s.user.id, updated_at: nowIso() }); await refreshServerState(); await offerMigration(); } }); }); }, { once: true });
      }
    } catch (e) { console.warn('cloud init', e); }
  }, 1200); });   // after the app is interactive; anonymous startup cost: zero network requests
})();
