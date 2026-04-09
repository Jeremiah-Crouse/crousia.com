import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';

export default function Comments({ date, readonly = false }) {
  const { name: contextName } = useContext(UserContext) || {};
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Initialize name from context if available and not 'guest'
  useEffect(() => {
    if (contextName && contextName !== 'guest' && !name) {
      setName(contextName);
    }
  }, [contextName]);

  useEffect(() => {
    fetchComments();
  }, [date]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/comments/${date}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !text || readonly) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, text }),
      });
      if (res.ok) {
        // Clear text but keep name/email for convenience
        setText('');
        fetchComments();
      }
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comments-section">
      <h3>Comments</h3>
      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="no-comments-text">No Comments</p>
      ) : (
        <ul className="comments-list">
          {comments.map((c, i) => (
            <li key={i} className="comment-item">
              <div className="comment-header">
                <strong>{c.name}</strong>
                <span className="comment-date">
                  {new Date(c.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="comment-text">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!readonly && (
        <form onSubmit={handleSubmit} className="comment-form">
          <h4>Leave a comment</h4>
          <div className="form-row">
            <div className="form-group">
              <input
                type="text"
                placeholder="Your Name (required)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <textarea
              placeholder="Write your comment here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="comment-submit-btn" disabled={submitting}>
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      )}
    </div>
  );
}
