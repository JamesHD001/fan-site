import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const tabs = ['users', 'memberships', 'payments', 'bookings', 'gift-transactions', 'gifts', 'posts'];

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok || !data?.success) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data.data;
}

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');
const money = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0) / 100);

export default function AdminManagementPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState('users');
  const [data, setData] = useState({ users: [], memberships: [], payments: [], bookings: [], 'gift-transactions': [], gifts: [], posts: [] });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [giftEditing, setGiftEditing] = useState(null);

  const endpointFor = (section) => section === 'posts' ? '/admin/posts/pending' : `/admin/${section}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (tab === 'users' && search.trim()) params.set('search', search.trim());
      if (['payments', 'bookings', 'gift-transactions'].includes(tab) && status) params.set('status', status);
      const query = params.toString();
      const result = await api(`${endpointFor(tab)}${query ? `?${query}` : ''}`, token);
      const records = result?.[tab] || result?.transactions || [];
      setData((current) => ({ ...current, [tab]: records }));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token && user?.role === 'ADMIN') load(); }, [token, user?.role, tab, status]);
  const rows = useMemo(() => data[tab] || [], [data, tab]);

  const action = async (id, path, body, method = 'PATCH') => {
    setBusyId(id); setError('');
    try { await api(path, token, { method, body: body ? JSON.stringify(body) : undefined }); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyId(null); }
  };

  const confirmDelete = async (row, path, description) => {
    if (!window.confirm(`Permanently delete ${description}? This cannot be undone.`)) return;
    await action(row._id, path, null, 'DELETE');
  };

  const deleteUser = async (row) => {
    if (String(row._id) === String(user?._id)) return;
    await confirmDelete(row, `/admin/users/${row._id}`, `${row.email || row.username || 'this user'} and all associated data`);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    await action(editing._id, `/admin/users/${editing._id}`, { name: editing.name, username: editing.username, email: editing.email, role: editing.role });
    setEditing(null);
  };

  const saveGift = async (event) => {
    event.preventDefault();
    await action(giftEditing._id, `/admin/gifts/${giftEditing._id}`, { name: giftEditing.name, description: giftEditing.description, image: giftEditing.image, price: Number(giftEditing.price), currency: giftEditing.currency, isActive: giftEditing.isActive, sortOrder: Number(giftEditing.sortOrder) });
    setGiftEditing(null);
  };

  if (user?.role !== 'ADMIN') return <main className="placeholder-page"><h1>Access denied</h1><Link to="/">Return home</Link></main>;

  return (
    <main className="admin-management-page page-container">
      <header className="page-header">
        <p className="eyebrow">ADMINISTRATION</p><h1>Management</h1>
        <p className="muted">Review and manage users, memberships, purchases, payments, gifts and community posts.</p>
        <div className="admin-management-nav"><Link className="secondary-button" to="/admin">Dashboard</Link><Link className="secondary-button" to="/">Return home</Link></div>
      </header>
      <nav className="admin-tabs" aria-label="Management sections">
        {tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSearch(''); setStatus(''); }}>{item.replaceAll('-', ' ')}</button>)}
      </nav>
      <section className="admin-toolbar">
        {tab === 'users' && <form onSubmit={(event) => { event.preventDefault(); load(); }}><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username or email" /><button className="secondary-button" type="submit">Search</button></form>}
        {['payments', 'bookings', 'gift-transactions'].includes(tab) && <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{tab === 'payments' && <><option>REQUIRES_REVIEW</option><option>PENDING_PAYMENT</option><option>PROOF_SUBMITTED</option><option>SUCCESS</option><option>FAILED</option><option>REJECTED</option><option>CANCELLED</option><option>EXPIRED</option></>}{tab === 'bookings' && <><option>PENDING_PAYMENT</option><option>CONFIRMED</option><option>DECLINED</option><option>COMPLETED</option><option>CANCELLED</option></>}{tab === 'gift-transactions' && <><option>PENDING_PAYMENT</option><option>COMPLETED</option><option>CANCELLED</option><option>FAILED</option></>}</select>}
      </section>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p>Loading management data…</p> : <section className="admin-table-wrap">
        {tab === 'users' && <table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => { const current = String(row._id) === String(user?._id); return <tr key={row._id}><td><strong>{row.name || row.username}</strong><small>{row.email}</small><small>@{row.username}</small></td><td>{row.role}</td><td>{row.isActive ? 'ACTIVE' : 'DISABLED'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button onClick={() => setEditing({ ...row })}>Edit</button><button disabled={busyId === row._id || current} onClick={() => action(row._id, `/admin/users/${row._id}/status`, { isActive: !row.isActive })}>{current ? 'Current account' : row.isActive ? 'Disable' : 'Enable'}</button><button className="danger" disabled={busyId === row._id || current} onClick={() => deleteUser(row)}>{current ? 'Current account' : 'Delete'}</button></td></tr>; })}</tbody></table>}
        {tab === 'memberships' && <table><thead><tr><th>Member</th><th>Plan</th><th>Status</th><th>Membership No.</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.plan?.name || '—'}<small>{money(row.plan?.price, row.plan?.currency || 'USD')}</small></td><td>{row.status}</td><td>{row.membershipNumber || '—'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/memberships/${row._id}`, 'this membership purchase and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'payments' && <table><thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.type}</td><td>{money(row.originalAmount, row.originalCurrency || 'USD')}</td><td>{row.status}</td><td>{row.reference}</td><td className="admin-actions"><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/payments/${row._id}`, 'this payment and its associated purchase')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'bookings' && <table><thead><tr><th>Customer</th><th>Meeting</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.meetingType?.name || 'Meeting'}</td><td>{formatDate(row.scheduledFor)}</td><td>{row.status}</td><td className="admin-actions"><button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'CONFIRMED' })}>Confirm</button><button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'DECLINED' })}>Decline</button><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/bookings/${row._id}`, 'this meeting booking and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'gift-transactions' && <table><thead><tr><th>Customer</th><th>Gift</th><th>Qty</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.gift?.name || 'Gift'}</td><td>{row.quantity}</td><td>{money(row.amount, row.gift?.currency || 'USD')}</td><td>{row.status}</td><td className="admin-actions"><button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'COMPLETED' })}>Complete</button><button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'CANCELLED' })}>Cancel</button><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/gift-transactions/${row._id}`, 'this gift purchase and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'gifts' && <table><thead><tr><th>Gift</th><th>Price</th><th>Visibility</th><th>Order</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td><strong>{row.name}</strong><small>{row.description}</small></td><td>{money(row.price, row.currency || 'USD')}</td><td>{row.isActive ? 'ACTIVE' : 'HIDDEN'}</td><td>{row.sortOrder}</td><td className="admin-actions"><button onClick={() => setGiftEditing({ ...row })}>Edit</button></td></tr>)}</tbody></table>}
        {tab === 'posts' && <table><thead><tr><th>Author</th><th>Content</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.author?.name || row.author?.username || '—'}<small>@{row.author?.username || '—'}</small></td><td className="post-preview">{row.content || row.body || '—'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'APPROVED' })}>Approve</button><button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REJECTED' })}>Reject</button><button className="danger" onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REMOVED' })}>Remove</button></td></tr>)}</tbody></table>}
        {rows.length === 0 && <div className="empty-state"><h2>No records found</h2><p className="muted">There are no records in this section.</p></div>}
      </section>}
      {editing && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={saveUser}><p className="eyebrow">USER MANAGEMENT</p><h2>Edit member</h2><label>Name<input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label>Username<input value={editing.username || ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></label><label>Email<input type="email" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label><label>Role<select value={editing.role || 'USER'} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></label><div className="admin-modal-actions"><button className="button button-primary">Save changes</button><button className="button button-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form></div>}
      {giftEditing && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={saveGift}><p className="eyebrow">GIFT MANAGEMENT</p><h2>Edit gift</h2><label>Name<input value={giftEditing.name || ''} onChange={(e) => setGiftEditing({ ...giftEditing, name: e.target.value })} /></label><label>Description<textarea rows="4" value={giftEditing.description || ''} onChange={(e) => setGiftEditing({ ...giftEditing, description: e.target.value })} /></label><label>Image URL<input value={giftEditing.image || ''} onChange={(e) => setGiftEditing({ ...giftEditing, image: e.target.value })} /></label><label>Price<input type="number" min="0" value={giftEditing.price ?? 0} onChange={(e) => setGiftEditing({ ...giftEditing, price: e.target.value })} /></label><label>Currency<input value={giftEditing.currency || 'USD'} onChange={(e) => setGiftEditing({ ...giftEditing, currency: e.target.value })} /></label><label>Sort order<input type="number" value={giftEditing.sortOrder ?? 0} onChange={(e) => setGiftEditing({ ...giftEditing, sortOrder: e.target.value })} /></label><label>Visible<select value={giftEditing.isActive ? 'true' : 'false'} onChange={(e) => setGiftEditing({ ...giftEditing, isActive: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Hidden</option></select></label><div className="admin-modal-actions"><button className="button button-primary">Save changes</button><button className="button button-ghost" type="button" onClick={() => setGiftEditing(null)}>Cancel</button></div></form></div>}
    </main>
  );
}
