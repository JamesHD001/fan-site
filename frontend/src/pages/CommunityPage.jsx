import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const getAuthorName = (author) => author?.name || author?.username || 'Fan'
const getAuthorUsername = (author) => author?.username ? `@${author.username}` : ''

export default function CommunityPage() {
  const { token, user } = useAuth()
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState({})
  const [commentText, setCommentText] = useState({})
  const [newPost, setNewPost] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadPosts = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(`${API_BASE_URL}/posts`, { headers })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load community posts.')
        if (!cancelled) setPosts(data.data?.posts || [])
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPosts()
    return () => { cancelled = true }
  }, [token])

  const loadComments = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`)
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load comments.')
      setComments((current) => ({ ...current, [postId]: data.data?.comments || [] }))
    } catch (commentError) {
      setError(commentError.message)
    }
  }

  const toggleLike = async (postId) => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update like.')
      setPosts((current) => current.map((post) => post._id === postId ? {
        ...post,
        likedByMe: data.data.liked,
        likeCount: data.data.likeCount,
      } : post))
    } catch (likeError) {
      setError(likeError.message)
    }
  }

  const submitComment = async (event, postId) => {
    event.preventDefault()
    const content = commentText[postId]?.trim()
    if (!content || !token) return
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to add comment.')
      setComments((current) => ({ ...current, [postId]: [data.data.comment, ...(current[postId] || [])] }))
      setCommentText((current) => ({ ...current, [postId]: '' }))
    } catch (commentError) {
      setError(commentError.message)
    }
  }

  const submitPost = async (event) => {
    event.preventDefault()
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newPost),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to create post.')
      setPosts((current) => [data.data.post, ...current])
      setNewPost({ title: '', content: '' })
    } catch (postError) {
      setError(postError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="placeholder-page"><h1>Community</h1><p>Loading posts…</p></main>

  return (
    <main className="community-page">
      <header className="page-header"><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Community</h1><p className="muted">Share, discuss, and connect with fellow fans.</p></header>
      {error && <p className="auth-error">{error}</p>}
      {user && <form className="post-composer" onSubmit={submitPost}><h2>Share something</h2><input required minLength="3" maxLength="150" placeholder="Post title" value={newPost.title} onChange={(event) => setNewPost({ ...newPost, title: event.target.value })} /><textarea required maxLength="5000" rows="4" placeholder="What would you like to share?" value={newPost.content} onChange={(event) => setNewPost({ ...newPost, content: event.target.value })} /><button className="primary-button" disabled={submitting}>{submitting ? 'Posting…' : 'Create post'}</button></form>}
      {!user && <p className="auth-error"><Link to="/login">Sign in</Link> to create posts, like, and comment.</p>}
      <section className="post-list" aria-label="Community posts">
        {posts.map((post) => <article className="post-card" key={post._id}>
          <div className="post-meta">
            <strong>{getAuthorName(post.author)}</strong>
            {getAuthorUsername(post.author) && <span className="muted">{getAuthorUsername(post.author)}</span>}
            <span className="muted">{new Date(post.createdAt).toLocaleDateString()}</span>
            {post.status !== 'APPROVED' && <span className="status-pill">{post.status}</span>}
          </div>
          <h2>{post.title}</h2><p>{post.content}</p>
          <div className="post-actions"><button className={`action-button${post.likedByMe ? ' action-active' : ''}`} type="button" disabled={!user} onClick={() => toggleLike(post._id)}>♥ {post.likeCount || 0}</button><button className="action-button" type="button" onClick={() => loadComments(post._id)}>Comments {post.commentCount || 0}</button></div>
          {comments[post._id] && <div className="comments"><ul>{comments[post._id].map((comment) => <li key={comment._id}><strong>{getAuthorName(comment.author)}</strong>{comment.author?.username && <small className="muted"> @{comment.author.username}</small>}<span>{comment.content}</span></li>)}</ul>{user && <form className="comment-form" onSubmit={(event) => submitComment(event, post._id)}><input required maxLength="1000" placeholder="Write a comment…" value={commentText[post._id] || ''} onChange={(event) => setCommentText({ ...commentText, [post._id]: event.target.value })} /><button className="secondary-button">Send</button></form>}</div>}
        </article>)}
      </section>
      {posts.length === 0 && !error && <div className="empty-state"><h2>No posts yet</h2><p className="muted">Be the first to start a conversation.</p></div>}
      <p className="muted back-link"><Link to="/">← Back to home</Link></p>
    </main>
  )
}
