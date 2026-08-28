import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const tabs = ['users', 'payments', 'bookings', 'gifts', 'gift-transactions', 'posts'];

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Request failed.');
  }

  return data.data;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function money(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0) / 100);
}

export default function AdminManagementPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState('users');
  const [data, setData] = useState({
    users: [],
    payments: [],
    bookings: [],
    gifts: [],
    'gift-transactions': [],
    posts: [],
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [giftEditing, setGiftEditing] = useState(null);

  const load = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });

      if (tab === 'users' && search.trim()) {
        params.set('search', search.trim());
      }

      if (['payments', 'bookings', 'gift-transactions'].includes(tab) && status) {
        params.set('status', status);
      }

      const result = await api(`/admin/${tab}?${params.toString()}`, token);
      const records = result?.[tab] || result?.transactions || [];

      setData((current) => ({ ...current, [tab]: records }));
      setPagination(result?.pagination || { page: 1, pages: 1, total: records.length });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      load(1);
    }
  }, [token, user?.role, tab, status]);

  const rows = useMemo(() => data[tab] || [], [data, tab]);

  const action = async (id, path, body, method = 'PATCH') => {
    setBusyId(id);
    setError('');

    try {
      await api(path, token, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      await load(pagination.page);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (row) => {
    const label = row.email || row.username || 'this user';
    const confirmed = window.confirm(
      `Permanently delete ${label} and ALL their data (memberships, payments, bookings, gifts, posts)? This cannot be undone.`,
    );

    if (!confirmed) return;
    await action(row._id, `/admin/users/${row._id}`, null, 'DELETE');
  };

  const saveUser = async (event) => {
    event.preventDefault();
    await action(editing._id, `/admin/users/${editing._id}`, {
      name: editing.name,
      username: editing.username,
      email: editing.email,
      role: editing.role,
    });
    setEditing(null);
  };

  const saveGift = async (event) => {
    event.preventDefault();
    await action(giftEditing._id, `/admin/gifts/${giftEditing._id}`, {
      name: giftEditing.name,
      description: giftEditing.description,
      image: giftEditing.image,
      price: Number(giftEditing.price),
      currency: giftEditing.currency,
      isActive: giftEditing.isActive,
      sortOrder: Number(giftEditing.sortOrder),
    });
    setGiftEditing(null);
  };

  if (user?.role !== 'ADMIN') {
    return (
      <main className="placeholder-page">
        <h1>Access denied</h1>
        <Link to="/">Return home</Link>
      </main>
    );
  }

  return (
    <main className="admin-management-page page-container">
      <header className="page-header">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Management</h1>
        <p className="muted">
          Review and manage users, memberships, transactions, bookings, gifts and community posts.
        </p>
        <div className="admin-management-nav">
          <Link className="secondary-button" to="/admin">Dashboard</Link>
          <Link className="secondary-button" to="/">Return home</Link>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Management sections">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            onClick={() => {
              setTab(item);
              setSearch('');
              setStatus('');
            }}
          >
            {item.replace('-', ' ')}
          </button>
        ))}
      </nav>

      <section className="admin-toolbar">
        {tab === 'users' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              load(1);
            }}
          >
            <input
              aria-label="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, username or email"
            />
            <button className="secondary-button" type="submit">Search</button>
          </form>
        )}

        {['payments', 'bookings', 'gift-transactions'].includes(tab) && (
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {tab === 'payments' && (
              <>
                <option value="REQUIRES_REVIEW">REQUIRES_REVIEW</option>
                <option value="PENDING">PENDING</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="ABANDONED">ABANDONED</option>
              </>
            )}
            {tab === 'bookings' && (
              <>
                <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="DECLINED">DECLINED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </>
            )}
            {tab === 'gift-transactions' && (
              <>
                <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="FAILED">FAILED</option>
              </>
            )}
          </select>
        )}

        <span>{pagination.total || 0} records</span>
      </section>

      {error && <p className="auth-error" role="alert">{error}</p>}

      {loading ? (
        <p>Loading management data…</p>
      ) : (
        <section className="admin-table-wrap">
          {tab === 'users' && (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Membership</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isCurrentUser = String(row._id) === String(user?._id);

                  return (
                    <tr key={row._id}>
                      <td>
                        <strong>{row.name || row.username}</strong>
                        <small>{row.email}</small>
                        <small>@{row.username}</small>
                      </td>
                      <td>{row.role}</td>
                      <td>
                        {row.isVerified ? '' : '⚠ UNVERIFIED '}
                        {row.membership?.plan?.name || 'None'}
                        <small>{row.membership?.status || ''}</small>
                      </td>
                      <td>{row.isActive ? 'ACTIVE' : 'DISABLED'}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td className="admin-actions">
                        <button onClick={() => setEditing({ ...row })}>Edit</button>
                        <button
                          disabled={busyId === row._id || isCurrentUser}
                          onClick={() => action(
                            row._id,
                            `/admin/users/${row._id}/status`,
                            { isActive: !row.isActive },
                          )}
                        >
                          {isCurrentUser ? 'Current account' : row.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="danger"
                          disabled={busyId === row._id || isCurrentUser}
                          onClick={() => deleteUser(row)}
                        >
                          {isCurrentUser ? 'Current account' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === 'payments' && (
            <table>
              <thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td>
                    <td>{row.type}</td>
                    <td>{money(row.amount, row.currency || 'NGN')}</td>
                    <td>
                      {row.status}
                      {row.status === 'REQUIRES_REVIEW' && (
                        <span style={{ marginLeft: 6, display: 'inline-flex', gap: 4 }}>
                          <button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/payments/${row._id}/review`, { resolution: 'CREDIT_AS_PAID' })}>Credit as paid</button>
                          <button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/payments/${row._id}/review`, { resolution: 'VOID' })}>Void</button>
                        </span>
                      )}
                    </td>
                    <td>{row.reference}</td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'bookings' && (
            <table>
              <thead><tr><th>Customer</th><th>Meeting</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.user?.name || row.user?.username || '—'}</td>
                    <td>{row.meetingType?.name || 'Meeting'}</td>
                    <td>{formatDate(row.scheduledFor)}</td>
                    <td>{row.status}</td>
                    <td className="admin-actions">
                      <button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'CONFIRMED' })}>Confirm</button>
                      <button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'DECLINED' })}>Decline</button>
                      <button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'COMPLETED' })}>Complete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'gifts' && (
            <table>
              <thead><tr><th>Gift</th><th>Price</th><th>Visibility</th><th>Order</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td><strong>{row.name}</strong><small>{row.description}</small></td>
                    <td>{money(row.price, row.currency || 'USD')}</td>
                    <td>{row.isActive ? 'ACTIVE' : 'HIDDEN'}</td>
                    <td>{row.sortOrder}</td>
                    <td className="admin-actions"><button onClick={() => setGiftEditing({ ...row })}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'gift-transactions' && (
            <table>
              <thead><tr><th>Customer</th><th>Gift</th><th>Qty</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td>
                    <td>{row.gift?.name || 'Gift'}</td>
                    <td>{row.quantity}</td>
                    <td>{money(row.amount, row.gift?.currency || 'USD')}</td>
                    <td>{row.status}</td>
                    <td className="admin-actions">
                      <button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'COMPLETED' })}>Complete</button>
                      <button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'CANCELLED' })}>Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'posts' && (
            <table>
              <thead><tr><th>Author</th><th>Content</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.author?.name || row.author?.username || '—'}</td>
                    <td className="post-preview">{row.content || row.body || '—'}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td className="admin-actions">
                      <button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'APPROVED' })}>Approve</button>
                      <button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REJECTED' })}>Reject</button>
                      <button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REMOVED' })}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {rows.length === 0 && (
            <div className="empty-state">
              <h2>No records found</h2>
              <p className="muted">There is nothing matching the current filters.</p>
            </div>
          )}
        </section>
      )}

      {pagination.pages > 1 && (
        <div className="admin-pagination">
          <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Previous</button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next →</button>
        </div>
      )}

      {editing && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={saveUser}>
            <p className="eyebrow">USER MANAGEMENT</p>
            <h2>Edit member</h2>
            <label>Name<input value={editing.name || ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label>Username<input value={editing.username || ''} onChange={(event) => setEditing({ ...editing, username: event.target.value })} /></label>
            <label>Email<input type="email" value={editing.email || ''} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></label>
            <label>Role<select value={editing.role || 'USER'} onChange={(event) => setEditing({ ...editing, role: event.target.value })}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></label>
            <div className="admin-modal-actions">
              <button className="button button-primary" disabled={busyId === editing._id}>Save changes</button>
              <button className="button button-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {giftEditing && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={saveGift}>
            <p className="eyebrow">GIFT MANAGEMENT</p>
            <h2>Edit gift</h2>
            <label>Name<input value={giftEditing.name || ''} onChange={(event) => setGiftEditing({ ...giftEditing, name: event.target.value })} /></label>
            <label>Description<textarea rows="4" value={giftEditing.description || ''} onChange={(event) => setGiftEditing({ ...giftEditing, description: event.target.value })} /></label>
            <label>Image URL<input value={giftEditing.image || ''} onChange={(event) => setGiftEditing({ ...giftEditing, image: event.target.value })} /></label>
            <label>Price (minor units)<input type="number" min="0" step="1" value={giftEditing.price ?? 0} onChange={(event) => setGiftEditing({ ...giftEditing, price: event.target.value })} /></label>
            <label>Currency<input value={giftEditing.currency || 'USD'} onChange={(event) => setGiftEditing({ ...giftEditing, currency: event.target.value })} /></label>
            <label>Sort order<input type="number" step="1" value={giftEditing.sortOrder ?? 0} onChange={(event) => setGiftEditing({ ...giftEditing, sortOrder: event.target.value })} /></label>
            <label>Visible<select value={giftEditing.isActive ? 'true' : 'false'} onChange={(event) => setGiftEditing({ ...giftEditing, isActive: event.target.value === 'true' })}><option value="true">Active</option><option value="false">Hidden</option></select></label>
            <div className="admin-modal-actions">
              <button className="button button-primary" disabled={busyId === giftEditing._id}>Save changes</button>
              <button className="button button-ghost" type="button" onClick={() => setGiftEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
