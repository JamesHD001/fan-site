import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/community.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1600

const getAuthorName = (author) => author?.name || author?.username || 'Fan'
const getAuthorUsername = (author) => author?.username ? `@${author.username}` : ''

const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Please select an image file.')); return }
  if (file.size > MAX_IMAGE_SIZE) { reject(new Error('Photo must be 5 MB or smaller.')); return }
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('Unable to read the selected photo.'))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error('Unable to process the selected photo.'))
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.src = reader.result
  }
  reader.readAsDataURL(file)
})

export default function CommunityPage() {
  const { token, user } = useAuth()
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState({})
  const [commentText, setCommentText] = useState({})
  const [newPost, setNewPost] = useState({ title: '', content: '', image: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const loadPosts = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(`${API_BASE_URL}/posts`, { headers })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load community posts.')
        if (!cancelled) setPosts(data.data?.posts || [])
      } catch (loadError) { if (!cancelled) setError(loadError.message) }
      finally { if (!cancelled) setLoading(false) }
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
    } catch (commentError) { setError(commentError.message) }
  }

  const toggleLike = async (postId) => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update like.')
      setPosts((current) => current.map((post) => post._id === postId ? { ...post, likedByMe: data.data.liked, likeCount: data.data.likeCount } : post))
    } catch (likeError) { setError(likeError.message) }
  }

  const submitComment = async (event, postId) => {
    event.preventDefault()
    const content = commentText[postId]?.trim()
    if (!content || !token) return
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to add comment.')
      setComments((current) => ({ ...current, [postId]: [data.data.comment, ...(current[postId] || [])] }))
      setCommentText((current) => ({ ...current, [postId]: '' }))
    } catch (commentError) { setError(commentError.message) }
  }

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setImageProcessing(true)
    try {
      const compressedImage = await compressImage(file)
      setNewPost((current) => ({ ...current, image: compressedImage }))
    } catch (photoError) {
      setError(photoError.message)
      event.target.value = ''
    } finally {
      setImageProcessing(false)
    }
  }

  const removePhoto = () => {
    setNewPost((current) => ({ ...current, image: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submitPost = async (event) => {
    event.preventDefault()
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(newPost) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to create post.')
      setPosts((current) => [data.data.post, ...current])
      setNewPost({ title: '', content: '', image: '' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (postError) { setError(postError.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <main className="placeholder-page"><h1>Community</h1><p>Loading posts…</p></main>

  return (
    <main className="community-page">
      <header className="page-header"><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Community</h1><p className="muted">Share, discuss, and connect with fellow fans.</p></header>
      {error && <p className="auth-error">{error}</p>}
      {user && <form className="post-composer" onSubmit={submitPost}>
        <h2>Share something</h2>
        <input required minLength="3" maxLength="150" placeholder="Post title" value={newPost.title} onChange={(event) => setNewPost({ ...newPost, title: event.target.value })} />
        <textarea required maxLength="5000" rows="4" placeholder="What would you like to share?" value={newPost.content} onChange={(event) => setNewPost({ ...newPost, content: event.target.value })} />
        {newPost.image && <div className="post-photo-preview"><img src={newPost.image} alt="Selected post preview" /><button type="button" className="photo-remove-button" onClick={removePhoto} aria-label="Remove selected photo">×</button></div>}
        <div className="post-composer-actions">
          <input ref={fileInputRef} className="sr-only" id="post-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          <label className="photo-upload-button" htmlFor="post-photo">＋ {imageProcessing ? 'Processing photo…' : newPost.image ? 'Change photo' : 'Add photo'}</label>
          <span className="photo-upload-hint">JPG, PNG or WebP · max 5 MB</span>
        </div>
        <button className="primary-button" disabled={submitting || imageProcessing}>{submitting ? 'Posting…' : 'Create post'}</button>
      </form>}
      {!user && <p className="auth-error"><Link to="/login">Sign in</Link> to create posts, like, and comment.</p>}
      <section className="post-list" aria-label="Community posts">
        {posts.map((post) => <article className="post-card" key={post._id}>
          <div className="post-meta"><strong>{getAuthorName(post.author)}</strong>{getAuthorUsername(post.author) && <span className="muted">{getAuthorUsername(post.author)}</span>}<span className="muted">{new Date(post.createdAt).toLocaleDateString()}</span>{post.status !== 'APPROVED' && <span className="status-pill">{post.status}</span>}</div>
          <h2>{post.title}</h2><p>{post.content}</p>
          {post.image && <img className="post-image" src={post.image} alt={post.title || 'Community post'} loading="lazy" />}
          <div className="post-actions"><button className={`action-button${post.likedByMe ? ' action-active' : ''}`} type="button" disabled={!user} onClick={() => toggleLike(post._id)}>♥ {post.likeCount || 0}</button><button className="action-button" type="button" onClick={() => loadComments(post._id)}>Comments {post.commentCount || 0}</button></div>
          {comments[post._id] && <div className="comments"><div className="comment-list">{comments[post._id].map((comment) => <div className="comment" key={comment._id}><strong>{getAuthorName(comment.author)}</strong><p>{comment.content}</p></div>)}</div>{user && <form className="comment-form" onSubmit={(event) => submitComment(event, post._id)}><input maxLength="1000" placeholder="Write a comment…" value={commentText[post._id] || ''} onChange={(event) => setCommentText((current) => ({ ...current, [post._id]: event.target.value }))} /><button className="secondary-button" type="submit">Comment</button></form>}</div>}
        </article>)}
        {!posts.length && <p className="muted">No community posts yet. Be the first to share something.</p>}
      </section>
    </main>
  )
}
