import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import './App.css'
import './styles/experience.css'
import './styles/membership.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import MembershipPage from './pages/MembershipPage'
import PaymentHistoryPage from './pages/PaymentHistoryPage'
import MeetingsPage from './pages/MeetingsPage'
import GiftsPage from './pages/GiftsPage'
import NotificationsPage from './pages/NotificationsPage'
import EventsPage from './pages/EventsPage'
import CommunityPage from './pages/CommunityPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminManagementPage from './pages/AdminManagementPage'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()
  if (loading) return <main className="placeholder-page"><p>Loading your account…</p></main>
  if (!isAuthenticated) return <NavigateToLogin from={location.pathname + location.search} />
  return children
}
function NavigateToLogin({ from }) { const navigate = useNavigate(); useEffect(() => { navigate('/login', { replace: true, state: { from } }) }, [navigate, from]); return <main className="placeholder-page"><p>Redirecting to sign in…</p></main> }

function PaymentCallback() {
  const [searchParams] = useSearchParams(); const navigate = useNavigate(); const { token, loading: authLoading, isAuthenticated } = useAuth()
  const [state, setState] = useState({ status: 'loading', message: 'Verifying your payment…', type: '', membership: null, booking: null, transaction: null, details: null })
  useEffect(() => { if (authLoading) return; const reference = searchParams.get('reference') || searchParams.get('trxref'); if (!reference) { setState((s) => ({ ...s, status: 'error', message: 'No payment reference was provided.' })); return }; if (!isAuthenticated || !token) { navigate('/login', { replace: true, state: { from: `/payment/callback?reference=${encodeURIComponent(reference)}` } }); return }; let cancelled = false; const verifyPayment = async () => { try { const response = await fetch(`${API_BASE_URL}/payments/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reference }) }); const data = await response.json(); if (cancelled) return; if (!response.ok || !data.success) { const e = new Error(data.message || 'We could not verify this payment.'); e.details = data.details || null; throw e }; setState({ status: 'success', type: data.type || '', message: data.message || 'Payment verified successfully.', membership: data.membership || null, booking: data.booking || null, transaction: data.transaction || null, details: null }) } catch (error) { if (!cancelled) setState({ status: 'error', message: error.message, type: '', membership: null, booking: null, transaction: null, details: error.details || null }) } }; verifyPayment(); return () => { cancelled = true } }, [authLoading, isAuthenticated, navigate, searchParams, token])
  if (authLoading) return <main className="payment-page"><div className="payment-card"><div className="payment-icon spinner" /><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Checking your account</h1><p>Preparing secure payment verification…</p></div></main>
  if (!isAuthenticated) return <main className="payment-page"><div className="payment-card"><div className="payment-icon spinner" /><p className="eyebrow">SECURE PAYMENT</p><h1>Sign in required</h1><p>Redirecting you to sign in so we can verify the payment securely.</p></div></main>
  if (state.status === 'loading') return <main className="payment-page"><div className="payment-card"><div className="payment-icon spinner" /><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Verifying your payment</h1><p>{state.message}</p><p className="muted">Please don't close this page.</p></div></main>
  if (state.status === 'success') { const destination = state.type === 'MEMBERSHIP' ? '/membership' : state.type === 'MEETING' ? '/meetings' : '/gifts'; const destinationLabel = state.type === 'MEMBERSHIP' ? 'View Membership' : state.type === 'MEETING' ? 'View Bookings' : 'View Gift History'; const detail = state.membership ? [['Membership', state.membership.plan?.name || state.membership.plan || 'Fan Membership'], ['Status', state.membership.status || 'ACTIVE']] : state.booking ? [['Meeting', state.booking.meetingType?.name || 'Meeting'], ['Status', state.booking.status || 'CONFIRMED']] : state.transaction ? [['Gift', state.transaction.gift?.name || 'Gift'], ['Status', state.transaction.status || 'COMPLETED']] : []; return <main className="payment-page"><div className="payment-card success-card"><div className="payment-icon success-icon">✓</div><p className="eyebrow">PAYMENT CONFIRMED</p><h1>{state.type === 'MEMBERSHIP' ? 'Welcome to the community.' : state.type === 'MEETING' ? 'Your meeting is confirmed.' : 'Your gift was sent.'}</h1><p>{state.message}</p>{detail.length > 0 && <div className="membership-summary">{detail.map(([label, value]) => <span key={label}>{label}<strong>{value}</strong></span>)}</div>}<div className="payment-actions"><Link className="primary-button" to={destination}>{destinationLabel}</Link><button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button></div></div></main> }
  return <main className="payment-page"><div className="payment-card error-card"><div className="payment-icon error-icon">!</div><p className="eyebrow">PAYMENT VERIFICATION</p><h1>We couldn't verify the payment.</h1><p>{state.message}</p>{state.details && <div className="membership-summary"><span>Expected amount<strong>{state.details.expectedAmount}</strong></span><span>Paystack amount<strong>{state.details.receivedAmount}</strong></span><span>Currency<strong>{state.details.currency}</strong></span></div>}<p className="muted">Your account has not been shown as successfully activated by this page.</p><div className="payment-actions"><button className="primary-button" type="button" onClick={() => window.location.reload()}>Try Again</button><button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button></div></div></main>
}

function App() { return <AuthProvider><BrowserRouter><SiteHeader /><Routes><Route path="/" element={<HomePage />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/payment/callback" element={<PaymentCallback />} /><Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} /><Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} /><Route path="/membership" element={<ProtectedRoute><MembershipPage /></ProtectedRoute>} /><Route path="/membership/payments" element={<ProtectedRoute><PaymentHistoryPage /></ProtectedRoute>} /><Route path="/meetings" element={<MeetingsPage />} /><Route path="/gifts" element={<GiftsPage />} /><Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} /><Route path="/events" element={<EventsPage />} /><Route path="/community" element={<CommunityPage />} /><Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} /><Route path="/admin/manage" element={<ProtectedRoute><AdminManagementPage /></ProtectedRoute>} /><Route path="*" element={<HomePage />} /></Routes><SiteFooter /></BrowserRouter></AuthProvider> }
export default App
