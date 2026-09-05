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
const statusLabel = { PENDING_PAYMENT: 'AWAITING PAYMENT', PROOF_SUBMITTED: 'PROOF SUBMITTED', SUCCESS: 'COMPLETED', REJECTED: 'REJECTED', FAILED: 'FAILED', CANCELLED: 'CANCELLED', EXPIRED: 'EXPIRED' };

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
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [paymentNote, setPaymentNote] = useState('');

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

  const openPaymentPreview = async (payment) => {
    setError('');
    setPaymentNote(payment.adminNote || '');
    setPaymentPreview({ ...payment, proofPreviewUrl: '' });
    if (!payment.proof?.fileUrl && !payment.proof?.fileId) return;
    setProofLoading(true);
    try {
      if (payment.proof.fileUrl?.startsWith('data:')) {
        setPaymentPreview({ ...payment, proofPreviewUrl: payment.proof.fileUrl });
        return;
      }
      const response = await fetch(`${API_BASE_URL}/payments/proof/${payment._id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to retrieve the stored payment proof.');
      const blob = await response.blob();
      setPaymentPreview({ ...payment, proofPreviewUrl: URL.createObjectURL(blob) });
    } catch (requestError) {
      setPaymentPreview(null);
      setError(requestError.message);
    } finally { setProofLoading(false); }
  };

  const closePaymentPreview = () => {
    if (paymentPreview?.proofPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(paymentPreview.proofPreviewUrl);
    setPaymentPreview(null);
    setPaymentNote('');
  };

  const paymentAction = async (type) => {
    if (!paymentPreview) return;
    const payment = paymentPreview;
    const hasProof = Boolean(payment.proof?.fileUrl || payment.proof?.fileId);
    if (type === 'confirm' && !hasProof) {
      setError('A payment cannot be confirmed until payment proof has been submitted.');
      return;
    }
    if (type === 'confirm' && !window.confirm('Confirm that you have verified this payment receipt and received the payment?')) return;
    if (type === 'reject' && !window.confirm('Reject this payment proof? The member will be allowed to submit replacement proof.')) return;
    setBusyId(payment._id); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/payments/admin/${payment._id}/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminNote: paymentNote.trim() || (type === 'reject' ? 'Payment proof was rejected.' : 'Payment receipt verified and payment received.') }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to update payment.');
      closePaymentPreview();
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(null); }
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
        {tab === 'payments' && <Link className="secondary-button" to="/admin/payments">Open full payment console</Link>}
      </section>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p>Loading management data…</p> : <section className="admin-table-wrap">
        {tab === 'users' && <table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => { const current = String(row._id) === String(user?._id); return <tr key={row._id}><td><strong>{row.name || row.username}</strong><small>{row.email}</small><small>@{row.username}</small></td><td>{row.role}</td><td>{row.isActive ? 'ACTIVE' : 'DISABLED'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button onClick={() => setEditing({ ...row })}>Edit</button><button disabled={busyId === row._id || current} onClick={() => action(row._id, `/admin/users/${row._id}/status`, { isActive: !row.isActive })}>{current ? 'Current account' : row.isActive ? 'Disable' : 'Enable'}</button><button className="danger" disabled={busyId === row._id || current} onClick={() => deleteUser(row)}>{current ? 'Current account' : 'Delete'}</button></td></tr>; })}</tbody></table>}
        {tab === 'memberships' && <table><thead><tr><th>Member</th><th>Plan</th><th>Status</th><th>Membership No.</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.plan?.name || '—'}<small>{money(row.plan?.price, row.plan?.currency || 'USD')}</small></td><td>{row.status}</td><td>{row.membershipNumber || '—'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/memberships/${row._id}`, 'this membership purchase and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'payments' && <>
          <div className="dashboard-panel"><h2>Payment review</h2><p className="muted">Open each request to inspect payment details and submitted receipts. Payments with submitted proof can be verified, completed or rejected from the review dialog.</p></div>
          <table><thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => {
            const hasProof = Boolean(row.proof?.fileUrl || row.proof?.fileId);
            const isSupport = String(row.supportAdmin?._id || row.supportAdmin) === String(user?._id);
            return <tr key={row._id}>
              <td><strong>{row.user?.name || row.user?.username || '—'}</strong><small>{row.user?.email}</small></td>
              <td>{row.type}<small>{row.metadata?.description || row.paymentToken}</small></td>
              <td>{money(row.originalAmount, row.originalCurrency || 'USD')}</td>
              <td><span className={`admin-status ${row.status === 'SUCCESS' || row.status === 'PROOF_SUBMITTED' ? 'good' : row.status === 'REJECTED' ? 'bad' : ''}`}>{statusLabel[row.status] || row.status}</span></td>
              <td>{row.reference}</td>
              <td className="admin-actions">
                <button onClick={() => openPaymentPreview(row)}>View details</button>
                {hasProof && <button onClick={() => openPaymentPreview(row)}>View receipt</button>}
                {row.status === 'PROOF_SUBMITTED' && <><button disabled={busyId === row._id || !isSupport} onClick={() => openPaymentPreview(row)}>{isSupport ? 'Review & verify' : 'Awaiting support admin'}</button><button className="secondary-button" disabled={busyId === row._id || !isSupport} onClick={() => { openPaymentPreview(row).then(() => paymentAction('confirm')); }}>Confirm payment</button><button className="danger" disabled={busyId === row._id || !isSupport} onClick={() => openPaymentPreview(row)}>Reject</button></>}
                {row.status === 'PENDING_PAYMENT' && <span className="muted">Awaiting member payment</span>}
                {row.status === 'REJECTED' && <span className="muted">Awaiting replacement proof</span>}
                {row.status === 'SUCCESS' && <span className="admin-status good">PAYMENT COMPLETE</span>}
              </td>
            </tr>;
          })}</tbody></table>
        </>}
        {tab === 'bookings' && <table><thead><tr><th>Customer</th><th>Meeting</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.meetingType?.name || 'Meeting'}</td><td>{formatDate(row.scheduledFor)}</td><td>{row.status}</td><td className="admin-actions"><button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'CONFIRMED' })}>Confirm</button><button onClick={() => action(row._id, `/admin/bookings/${row._id}/status`, { status: 'DECLINED' })}>Decline</button><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/bookings/${row._id}`, 'this meeting booking and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'gift-transactions' && <table><thead><tr><th>Customer</th><th>Gift</th><th>Qty</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.user?.name || row.user?.username || '—'}<small>{row.user?.email}</small></td><td>{row.gift?.name || 'Gift'}</td><td>{row.quantity}</td><td>{money(row.amount, row.gift?.currency || 'USD')}</td><td>{row.status}</td><td className="admin-actions"><button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'COMPLETED' })}>Complete</button><button disabled={busyId === row._id} onClick={() => action(row._id, `/admin/gift-transactions/${row._id}/status`, { status: 'CANCELLED' })}>Cancel</button><button className="danger" disabled={busyId === row._id} onClick={() => confirmDelete(row, `/admin/gift-transactions/${row._id}`, 'this gift purchase and its payment record')}>Delete</button></td></tr>)}</tbody></table>}
        {tab === 'gifts' && <table><thead><tr><th>Gift</th><th>Price</th><th>Visibility</th><th>Order</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td><strong>{row.name}</strong><small>{row.description}</small></td><td>{money(row.price, row.currency || 'USD')}</td><td>{row.isActive ? 'ACTIVE' : 'HIDDEN'}</td><td>{row.sortOrder}</td><td className="admin-actions"><button onClick={() => setGiftEditing({ ...row })}>Edit</button></td></tr>)}</tbody></table>}
        {tab === 'posts' && <table><thead><tr><th>Author</th><th>Content</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.author?.name || row.author?.username || '—'}<small>@{row.author?.username || '—'}</small></td><td className="post-preview">{row.content || row.body || '—'}</td><td>{formatDate(row.createdAt)}</td><td className="admin-actions"><button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'APPROVED' })}>Approve</button><button onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REJECTED' })}>Reject</button><button className="danger" onClick={() => action(row._id, `/admin/posts/${row._id}/moderate`, { status: 'REMOVED' })}>Remove</button></td></tr>)}</tbody></table>}
        {rows.length === 0 && <div className="empty-state"><h2>No records found</h2><p className="muted">There are no records in this section.</p></div>}
      </section>}

      {paymentPreview && <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment review" onClick={closePaymentPreview}>
        <section className="admin-modal admin-proof-modal" onClick={(event) => event.stopPropagation()}>
          <div className="proof-modal-header"><div><p className="eyebrow">PAYMENT REVIEW</p><h2>{paymentPreview.user?.name || paymentPreview.user?.username || 'Member'}</h2><p className="muted">{paymentPreview.metadata?.description || paymentPreview.type} · {paymentPreview.paymentToken}</p></div><button className="text-button" onClick={closePaymentPreview}>Close</button></div>
          <div className="proof-review-meta"><span><strong>Amount</strong>{money(paymentPreview.originalAmount, paymentPreview.originalCurrency)}</span><span><strong>Status</strong>{statusLabel[paymentPreview.status] || paymentPreview.status}</span><span><strong>Requested</strong>{formatDate(paymentPreview.createdAt)}</span><span><strong>Receipt</strong>{paymentPreview.proof?.originalName || 'Not submitted'}</span></div>
          <div className="proof-review-meta"><span><strong>Method</strong>{paymentPreview.paymentMethod === 'CRYPTO' ? `${paymentPreview.crypto?.currency || 'Crypto'} · ${paymentPreview.crypto?.network || '—'}` : paymentPreview.paymentMethod === 'GIFTCARD' ? `Gift card · ${paymentPreview.giftCard?.brand || '—'}` : 'Not selected'}</span>{paymentPreview.paymentMethod === 'CRYPTO' && <span><strong>Wallet</strong><code>{paymentPreview.crypto?.walletAddress || '—'}</code></span>}{paymentPreview.paymentMethod === 'GIFTCARD' && <span><strong>Instructions</strong>{paymentPreview.giftCard?.instructions || '—'}</span>}</div>
          {proofLoading ? <div className="proof-preview-frame"><p>Loading secure receipt…</p></div> : paymentPreview.proofPreviewUrl?.startsWith('data:image/') || (paymentPreview.proofPreviewUrl?.startsWith('blob:') && paymentPreview.proof?.fileType?.startsWith('image/')) ? <div className="proof-preview-frame"><img src={paymentPreview.proofPreviewUrl} alt="Submitted payment receipt" /></div> : paymentPreview.proofPreviewUrl?.startsWith('data:application/pdf') || (paymentPreview.proofPreviewUrl?.startsWith('blob:') && paymentPreview.proof?.fileType === 'application/pdf') ? <iframe className="proof-preview-frame proof-pdf" src={paymentPreview.proofPreviewUrl} title="Submitted payment receipt PDF" /> : <div className="proof-preview-frame"><p className="muted">No receipt is currently available to preview.</p></div>}
          <label>Administrator note<textarea rows="3" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional verification or rejection note" /></label>
          <div className="admin-modal-actions">
            {paymentPreview.proofPreviewUrl && <a className="secondary-button" href={paymentPreview.proofPreviewUrl} target="_blank" rel="noreferrer">Open full receipt</a>}
            {paymentPreview.status === 'PROOF_SUBMITTED' && <><button className="danger" disabled={busyId === paymentPreview._id} onClick={() => paymentAction('reject')}>Reject proof</button><button className="button button-primary" disabled={busyId === paymentPreview._id || String(paymentPreview.supportAdmin?._id || paymentPreview.supportAdmin) !== String(user?._id)} onClick={() => paymentAction('confirm')}>{busyId === paymentPreview._id ? 'Confirming…' : 'Verify & complete payment'}</button></>}
            <button className="button button-ghost" onClick={closePaymentPreview}>Close</button>
          </div>
        </section>
      </div>}

      {editing && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={saveUser}><p className="eyebrow">USER MANAGEMENT</p><h2>Edit member</h2><label>Name<input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label>Username<input value={editing.username || ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></label><label>Email<input type="email" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label><label>Role<select value={editing.role || 'USER'} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></label><div className="admin-modal-actions"><button className="button button-primary">Save changes</button><button className="button button-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form></div>}
      {giftEditing && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={saveGift}><p className="eyebrow">GIFT MANAGEMENT</p><h2>Edit gift</h2><label>Name<input value={giftEditing.name || ''} onChange={(e) => setGiftEditing({ ...giftEditing, name: e.target.value })} /></label><label>Description<textarea rows="4" value={giftEditing.description || ''} onChange={(e) => setGiftEditing({ ...giftEditing, description: e.target.value })} /></label><label>Image URL<input value={giftEditing.image || ''} onChange={(e) => setGiftEditing({ ...giftEditing, image: e.target.value })} /></label><label>Price<input type="number" min="0" value={giftEditing.price ?? 0} onChange={(e) => setGiftEditing({ ...giftEditing, price: e.target.value })} /></label><label>Currency<input value={giftEditing.currency || 'USD'} onChange={(e) => setGiftEditing({ ...giftEditing, currency: e.target.value })} /></label><label>Sort order<input type="number" value={giftEditing.sortOrder ?? 0} onChange={(e) => setGiftEditing({ ...giftEditing, sortOrder: e.target.value })} /></label><label>Visible<select value={giftEditing.isActive ? 'true' : 'false'} onChange={(e) => setGiftEditing({ ...giftEditing, isActive: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Hidden</option></select></label><div className="admin-modal-actions"><button className="button button-primary">Save changes</button><button className="button button-ghost" type="button" onClick={() => setGiftEditing(null)}>Cancel</button></div></form></div>}
    </main>
  );
}
