import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function NotificationsPage() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadNotifications = async () => {
      setLoading(true)
      try {
        const query = showUnreadOnly ? '?unread=true' : ''
        const response = await fetch(`${API_BASE_URL}/notifications${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Unable to load notifications.')
        }

        if (!cancelled) {
          setNotifications(data.data?.notifications || [])
          setUnreadCount(data.data?.unreadCount || 0)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNotifications()
    return () => { cancelled = true }
  }, [showUnreadOnly, token])

  const markAsRead = async (notificationId) => {
    setBusyId(notificationId)
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update notification.')

      setNotifications((current) => current.map((notification) => (
        notification._id === notificationId
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      )))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (readError) {
      setError(readError.message)
    } finally {
      setBusyId(null)
    }
  }

  const markAllAsRead = async () => {
    setBusyId('all')
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update notifications.')

      setNotifications((current) => current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date().toISOString(),
      })))
      setUnreadCount(0)
    } catch (readError) {
      setError(readError.message)
    } finally {
      setBusyId(null)
    }
  }

  const deleteNotification = async (notificationId) => {
    setBusyId(notificationId)
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to delete notification.')

      const removed = notifications.find((notification) => notification._id === notificationId)
      setNotifications((current) => current.filter((notification) => notification._id !== notificationId))
      if (removed && !removed.isRead) setUnreadCount((count) => Math.max(0, count - 1))
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="notifications-page">
      <header className="page-header notification-header">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>Notifications</h1>
        <div className="notification-toolbar">
          <span className="unread-count">{unreadCount} unread</span>
          <button className="secondary-button" type="button" onClick={() => setShowUnreadOnly((value) => !value)}>
            {showUnreadOnly ? 'Show all' : 'Unread only'}
          </button>
          {unreadCount > 0 && (
            <button className="secondary-button" type="button" disabled={busyId === 'all'} onClick={markAllAsRead}>
              {busyId === 'all' ? 'Updating…' : 'Mark all read'}
            </button>
          )}
        </div>
      </header>

      {error && <p className="auth-error">{error}</p>}
      {loading && <p>Loading notifications…</p>}
      {!loading && !error && notifications.length === 0 && (
        <div className="empty-state"><h2>All caught up</h2><p className="muted">You have no notifications here.</p></div>
      )}

      <ul className="notification-list">
        {notifications.map((notification) => (
          <li className={`notification-item${notification.isRead ? '' : ' notification-unread'}`} key={notification._id}>
            <div className="notification-content">
              <div className="notification-meta">
                <span className="notification-type">{notification.type}</span>
                <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
              </div>
              <h2>{notification.title}</h2>
              <p>{notification.message}</p>
              {notification.link && <Link className="notification-link" to={notification.link}>View details →</Link>}
            </div>
            <div className="notification-actions">
              {!notification.isRead && (
                <button className="secondary-button" type="button" disabled={busyId === notification._id} onClick={() => markAsRead(notification._id)}>
                  Mark read
                </button>
              )}
              <button className="text-button" type="button" disabled={busyId === notification._id} onClick={() => deleteNotification(notification._id)}>
                Delete              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="muted back-link"><Link to="/">← Back to home</Link></p>
    </main>
  )
}
