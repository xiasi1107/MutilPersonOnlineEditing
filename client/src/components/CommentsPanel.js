import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Autocomplete,
  Paper,
  Card,
  CardContent
} from '@mui/material';
import {
  Send as SendIcon,
  Reply as ReplyIcon,
  Comment as CommentIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import axios from 'axios';

import { useAuth } from '../contexts/AuthContext';

const CommentsPanel = ({ documentId, quillRef, onCommentAdded, comments: commentsProp, onCommentsChange, selectedCommentId, onCommentSelect }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState(commentsProp || []);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [mentionInput, setMentionInput] = useState('');
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const mentionInputRef = useRef(null);

  useEffect(() => {
    if (commentsProp) {
      setComments(commentsProp);
    }
  }, [commentsProp]);

  useEffect(() => {
    if (documentId && (!commentsProp || commentsProp.length === 0)) {
      fetchComments();
    }
  }, [documentId]);

  useEffect(() => {
    if (!quillRef?.current) return;

    const quill = quillRef.current.getEditor();
    const handleSelectionChange = (range) => {
      if (range && range.length > 0) {
        const text = quill.getText(range.index, range.length);
        setSelectedText(text);
        setSelectedRange(range);
      }
    };

    quill.on('selection-change', handleSelectionChange);
    return () => {
      quill.off('selection-change', handleSelectionChange);
    };
  }, [quillRef]);

  const fetchComments = async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      const response = await axios.get(`/api/comments/document/${documentId}`);
      setComments(response.data || []);
    } catch (error) {
      console.error('获取评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsersForMention = async (query) => {
    if (!query || query.length < 1) {
      setSearchUsers([]);
      return;
    }
    try {
      setSearchingUsers(true);
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
      setSearchUsers(response.data || []);
    } catch (error) {
      console.error('搜索用户失败:', error);
      setSearchUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleMentionInput = (e, isReply = false) => {
    const value = e.target.value;
    if (isReply) {
      setReplyContent(value);
    } else {
      setNewComment(value);
    }
    
    const atIndex = value.lastIndexOf('@');
    if (atIndex !== -1) {
      const query = value.substring(atIndex + 1).split(/\s/)[0];
      if (query.length > 0 && !query.includes('@')) {
        setShowMentionAutocomplete(true);
        searchUsersForMention(query);
      } else {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  const handleMentionSelect = (selectedUser, isReply = false) => {
    const currentValue = isReply ? replyContent : newComment;
    const atIndex = currentValue.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = currentValue.substring(0, atIndex);
      const afterAt = currentValue.substring(atIndex + 1);
      const queryEnd = afterAt.indexOf(' ') !== -1 ? afterAt.indexOf(' ') : afterAt.length;
      const newValue = `${beforeAt}@${selectedUser.nickname || selectedUser.username} ${currentValue.substring(atIndex + 1 + queryEnd)}`;
      
      if (isReply) {
        setReplyContent(newValue);
      } else {
        setNewComment(newValue);
      }
      
      if (!mentionUsers.find(u => u.id === selectedUser.id)) {
        setMentionUsers([...mentionUsers, selectedUser]);
      }
    }
    setShowMentionAutocomplete(false);
  };

  const extractMentions = async (text) => {
    const mentions = [];
    const mentionRegex = /@([^\s@]+)/g;
    let match;
    const mentionedUsernames = new Set();
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      if (!mentionedUsernames.has(username)) {
        mentionedUsernames.add(username);
        try {
          const response = await axios.get(`/api/users/search?q=${encodeURIComponent(username)}&limit=10`);
          const users = response.data || [];
          const user = users.find(u => 
            (u.nickname || u.username) === username
          );
          if (user) {
            mentions.push(user.id);
          }
        } catch (error) {
          console.error('搜索提及用户失败:', error);
        }
      }
    }
    return mentions;
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !documentId) return;

    try {
      const quill = quillRef?.current?.getEditor();
      let position = null;
      
      if (selectedRange) {
        position = `${selectedRange.index}-${selectedRange.index + selectedRange.length}`;
      } else if (quill) {
        const selection = quill.getSelection();
        if (selection) {
          position = `${selection.index}-${selection.index}`;
        }
      }

      const mentions = await extractMentions(newComment);
      
      await axios.post('/api/comments', {
        documentId,
        content: newComment,
        position,
        mentions: mentions.length > 0 ? mentions : undefined
      });

      setNewComment('');
      setMentionInput('');
      setMentionUsers([]);
      setSelectedText('');
      setSelectedRange(null);
      await fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
      if (onCommentsChange) {
        onCommentsChange();
      }
    } catch (error) {
      console.error('添加评论失败:', error);
      alert('添加评论失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleReply = async (parentComment) => {
    if (!replyContent.trim()) return;

    try {
      const mentions = await extractMentions(replyContent);
      
      await axios.post('/api/comments', {
        documentId,
        content: replyContent,
        parentId: parentComment.id,
        mentions: mentions.length > 0 ? mentions : undefined
      });

      setReplyingTo(null);
      setReplyContent('');
      setMentionInput('');
      setMentionUsers([]);
      await fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
      if (onCommentsChange) {
        onCommentsChange();
      }
    } catch (error) {
      console.error('回复评论失败:', error);
      alert('回复评论失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (comment) => {
    if (!window.confirm('确定要删除这条评论吗？')) {
      return;
    }
    
    try {
      await axios.delete(`/api/comments/${comment.id}`);
      fetchComments();
      if (onCommentsChange) {
        onCommentsChange();
      }
    } catch (error) {
      console.error('删除评论失败:', error);
      alert('删除评论失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const renderComment = (comment, level = 0) => {
    const replies = comments.filter(c => c.parentId === comment.id);
    const mentions = comment.mentions ? comment.mentions.split(',').map(Number) : [];
    const isSelected = selectedCommentId === comment.id;

    return (
      <React.Fragment key={comment.id}>
        <ListItem
          data-comment-item-id={comment.id}
          onClick={(e) => {
            e.stopPropagation();
            if (onCommentSelect) {
              onCommentSelect(comment.id);
            }
          }}
          sx={{
            pl: level * 4 + 2,
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            borderLeft: level > 0 ? '2px solid' : 'none',
            borderColor: 'divider',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        >
          <ListItemAvatar>
            <Avatar
              src={comment.user?.avatar ? (comment.user.avatar.startsWith('http') ? comment.user.avatar : `http://127.0.0.1:3001${comment.user.avatar}`) : undefined}
            >
              {comment.user?.nickname?.[0] || comment.user?.username?.[0] || 'U'}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2">
                  {comment.user?.nickname || comment.user?.username}
                </Typography>
                {mentions.length > 0 && (
                  <Chip label={`@${mentions.length}人`} size="small" variant="outlined" />
                )}
                <Typography variant="caption" color="text.secondary">
                  {new Date(comment.createdAt).toLocaleString()}
                </Typography>
              </Box>
            }
            secondary={
              <Box>
                <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </Typography>
                {comment.position && (
                  <Chip
                    label={`位置: ${comment.position}`}
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      const [start, end] = comment.position.split('-').map(Number);
                      const quill = quillRef?.current?.getEditor();
                      if (quill) {
                        quill.setSelection(start, end - start);
                        quill.scrollIntoView();
                      }
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyingTo(replyingTo === comment.id ? null : comment.id);
                    }}
                    title="回复"
                  >
                    <ReplyIcon fontSize="small" />
                  </IconButton>
                  {user && (user.id === comment.userId || user.role === 'admin') && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(comment);
                      }}
                      color="error"
                      title="删除评论"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                {replyingTo === comment.id && (
                  <Box sx={{ mt: 2 }} onClick={(e) => e.stopPropagation()}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="输入回复，使用 @ 提及用户..."
                      value={replyContent}
                      onChange={(e) => handleMentionInput(e, true)}
                      onFocus={(e) => {
                        e.stopPropagation();
                        const quill = quillRef?.current?.getEditor();
                        if (quill) {
                          quill.blur();
                        }
                      }}
                      size="small"
                      sx={{ 
                        mb: 1,
                        '& .MuiInputBase-input': {
                          bgcolor: 'transparent',
                          backgroundColor: 'transparent'
                        },
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'transparent',
                          backgroundColor: 'transparent'
                        }
                      }}
                    />
                    {showMentionAutocomplete && searchUsers.length > 0 && (
                      <Paper sx={{ position: 'absolute', zIndex: 1300, maxHeight: 200, overflow: 'auto' }}>
                        <List dense>
                          {searchUsers.map((u) => (
                            <ListItem
                              key={u.id}
                              button
                              onClick={() => handleMentionSelect(u, true)}
                            >
                              <ListItemAvatar>
                                <Avatar
                                  src={u.avatar ? (u.avatar.startsWith('http') ? u.avatar : `http://127.0.0.1:3001${u.avatar}`) : undefined}
                                >
                                  {u.nickname?.[0] || u.username?.[0] || 'U'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={u.nickname || u.username}
                                secondary={u.email}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(comment);
                        }}
                        startIcon={<SendIcon />}
                      >
                        回复
                      </Button>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                      >
                        取消
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            }
          />
        </ListItem>
        {replies.map(reply => renderComment(reply, level + 1))}
      </React.Fragment>
    );
  };

  const topLevelComments = comments.filter(c => !c.parentId);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      borderLeft: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper'
    }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <CommentIcon />
        <Typography variant="h6">评论</Typography>
        <Chip label={comments.length} size="small" />
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {selectedText && (
          <Card sx={{ mb: 2, bgcolor: 'action.selected' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  选中文本:
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedText('');
                    setSelectedRange(null);
                  }}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  ✕
                </Button>
              </Box>
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {selectedText}
              </Typography>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : topLevelComments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            暂无评论
            <br />
            <Typography variant="caption">
              选择文本后添加评论
            </Typography>
          </Typography>
        ) : (
          <List>
            {topLevelComments.map(comment => renderComment(comment))}
          </List>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', position: 'relative' }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder={selectedText ? "对选中文本添加评论，使用 @ 提及用户..." : "选择文本后添加评论，或使用 @ 提及用户..."}
            value={newComment}
            onChange={(e) => handleMentionInput(e, false)}
            onFocus={(e) => {
              const quill = quillRef?.current?.getEditor();
              if (quill) {
                quill.blur();
              }
            }}
            sx={{ 
              mb: 1,
              '& .MuiInputBase-input': {
                bgcolor: 'transparent',
                backgroundColor: 'transparent'
              },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'transparent',
                backgroundColor: 'transparent'
              }
            }}
          />
        {showMentionAutocomplete && searchUsers.length > 0 && (
          <Paper sx={{ position: 'absolute', bottom: '100%', left: 16, right: 16, zIndex: 1300, maxHeight: 200, overflow: 'auto', mb: 1, boxShadow: 3 }}>
            <List dense>
              {searchUsers.map((u) => (
                <ListItem
                  key={u.id}
                  button
                  onClick={() => handleMentionSelect(u, false)}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={u.avatar ? (u.avatar.startsWith('http') ? u.avatar : `http://127.0.0.1:3001${u.avatar}`) : undefined}
                    >
                      {u.nickname?.[0] || u.username?.[0] || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.nickname || u.username}
                    secondary={u.email}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
        <Button
          fullWidth
          variant="contained"
          onClick={handleAddComment}
          startIcon={<SendIcon />}
          disabled={!newComment.trim()}
        >
          添加评论
        </Button>
      </Box>
    </Box>
  );
};

export default CommentsPanel;