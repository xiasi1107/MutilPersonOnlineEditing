import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  Chip,
  Avatar,
  AvatarGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Share as ShareIcon,
  Close as CloseIcon,
  Comment as CommentIcon,
  History as HistoryIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Search as SearchIcon,
  Close as CloseSearchIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Assignment as AssignmentIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import CommentsPanel from '../components/CommentsPanel';
import VideoConference from '../components/VideoConference';
import TasksPanel from '../components/TasksPanel';
import VersionHistoryDialog from '../components/VersionHistoryDialog';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentSocket } from '../hooks/useDocumentSocket';
import { useCursorIndicators } from '../hooks/useCursorIndicators';
import { useDocumentSearch } from '../hooks/useDocumentSearch';
import axios from 'axios';

// 添加光标闪烁动画样式和评论红色下划线样式
const cursorStyles = `
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }
  .quill-cursor-indicator {
    animation: blink 1s infinite;
  }
  .comment-yellow-highlight {
    background-color: #fff3cd !important;
    padding: 2px 0 !important;
  }
  .search-highlight {
    background-color: #ffeb3b !important;
    padding: 2px 0 !important;
  }
  .search-highlight-current {
    background-color: #ff9800 !important;
    padding: 2px 0 !important;
    font-weight: bold;
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = cursorStyles;
  if (!document.head.querySelector('style[data-cursor-indicator]')) {
    styleSheet.setAttribute('data-cursor-indicator', 'true');
    document.head.appendChild(styleSheet);
  }
}

const DocumentEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const viewMode = searchParams.get('viewMode') || 'list'; // 获取视图模式，默认为 'list'
  console.log('DocumentEditor: viewMode from URL =', viewMode);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [userTags, setUserTags] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editors, setEditors] = useState([]);
  const [otherUsersCursors, setOtherUsersCursors] = useState({}); // userId -> cursor info
  const saveTimeoutRef = useRef(null);
  const quillRef = useRef(null);
  // 使用 useCursorIndicators hook
  const { updateCursorIndicator, cleanup: cleanupCursors } = useCursorIndicators(
    quillRef,
    editors,
    user?.id,
    otherUsersCursors,
    setOtherUsersCursors
  );
  
  // 使用 useDocumentSocket hook
  const { socket, emitDocumentEdit, emitTitleUpdate, emitCursorUpdate } = useDocumentSocket(
    id,
    ({ content: newContent, userId }) => {
      if (userId !== user.id) {
        console.log('收到文档更新:', userId);
        // 保存当前光标位置
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const selection = quill.getSelection();
          setContent(newContent);
          // 恢复光标位置
          setTimeout(() => {
            if (selection) {
              quill.setSelection(selection);
            }
          }, 0);
        } else {
          setContent(newContent);
        }
      }
    },
    ({ title: newTitle, userId: updatedUserId }) => {
      // 更新标题（如果其他用户修改了标题）
      if (updatedUserId !== user.id) {
        setTitle(newTitle);
      }
    },
    ({ userId, position, selection }) => {
      // 更新所有用户的光标位置（包括自己的）
      setOtherUsersCursors(prev => ({
        ...prev,
        [userId]: { position, selection, timestamp: Date.now() }
      }));
      // 立即在编辑器中显示光标位置
      updateCursorIndicator(userId, position, selection);
    },
    ({ user: joinedUser, editors: editorList }) => {
      console.log('用户加入:', joinedUser, '所有编辑者:', editorList);
      // 如果后端发送了完整的编辑者列表，使用它；否则只添加新加入的用户
      if (editorList && Array.isArray(editorList) && editorList.length > 0) {
        // 使用后端发送的完整编辑者列表
        setEditors(editorList);
      } else {
        // 只添加新加入的用户
        setEditors(prev => {
          const newEditors = [...prev];
          if (!newEditors.find(e => e.id === joinedUser.id)) {
            newEditors.push(joinedUser);
          }
          return newEditors;
        });
      }
      // 立即将当前用户添加到编辑者列表（确保自己的光标能显示）
      setEditors(prev => {
        const newEditors = [...prev];
        if (!newEditors.find(e => e.id === user.id)) {
          newEditors.push({
            id: user.id,
            username: user.username,
            nickname: user.nickname || user.username,
            avatar: user.avatar
          });
        }
        return newEditors;
      });
    },
    ({ userId, editors: editorList }) => {
      console.log('用户离开:', userId);
      // 移除离开的用户
      setEditors(prev => prev.filter(e => e.id !== userId));
      // 清除该用户的光标
      setOtherUsersCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
      // 光标指示器清理由 useCursorIndicators hook 处理
    }
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPermission, setSelectedPermission] = useState('read');
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [document, setDocument] = useState(null);
  const [searching, setSearching] = useState(false);
  const [userPermission, setUserPermission] = useState(null); // 当前用户对该文档的权限
  const [isDocumentLocked, setIsDocumentLocked] = useState(false); // 文档是否被锁定
  const [lockingDocument, setLockingDocument] = useState(false); // 是否正在锁定/解锁文档
  const [permissionRequested, setPermissionRequested] = useState(false); // 是否已申请权限
  const [requestingPermission, setRequestingPermission] = useState(false); // 是否正在申请权限
  const [comments, setComments] = useState([]); // 评论列表
  const [selectedCommentId, setSelectedCommentId] = useState(null); // 选中的评论ID
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(true); // 评论面板显示状态
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false); // 版本历史对话框显示状态
  // 使用 useDocumentSearch hook
  const {
    searchKeyword,
    setSearchKeyword,
    searchMatches,
    currentMatchIndex,
    searchOpen,
    setSearchOpen,
    navigateToPreviousMatch,
    navigateToNextMatch,
    closeSearch
  } = useDocumentSearch(quillRef);
  // 任务相关状态
  const [tasksPanelOpen, setTasksPanelOpen] = useState(true); // 任务面板显示状态
  // 视频会议相关状态
  const [videoConferenceOpen, setVideoConferenceOpen] = useState(false); // 视频会议对话框是否打开
  const [availableUsers, setAvailableUsers] = useState([]); // 可用于分配的用户列表（用于视频会议）
  const [loadingUsers, setLoadingUsers] = useState(false); // 是否正在加载用户列表

  const fetchDocument = useCallback(async () => {
    // 如果是 'new'，创建新文档
    if (id === 'new') {
      try {
        const response = await axios.post('/api/documents', {
          title: '',
          content: ''
        });
        // 创建成功后导航到新文档的编辑页面
        navigate(`/documents/${response.data.document.id}`, { replace: true });
        return;
      } catch (error) {
        console.error('创建文档失败:', error);
        navigate(`/documents${viewMode !== 'list' ? `?viewMode=${viewMode}` : ''}`);
        return;
      }
    }
    
    try {
      const response = await axios.get(`/api/documents/${id}`);
      const doc = response.data.document;
      setDocument(doc); // 保存文档对象，用于检查创建者
      setTitle(doc.title);
      setContent(doc.content || '');
      // 设置文档的标签和文件夹
      if (doc.tags) {
        const tagNames = doc.tags.split(',').map(t => t.trim()).filter(t => t);
        setSelectedTags(tagNames);
      } else {
        setSelectedTags([]);
      }
      setSelectedFolder(doc.folder || null);
      // 设置文档锁定状态
      setIsDocumentLocked(doc.isLocked || false);
      // 设置用户权限（从响应中获取）
      if (response.data.userPermission) {
        setUserPermission(response.data.userPermission);
      } else {
        // 如果没有返回权限信息，默认为 read（只读）
        setUserPermission('read');
      }
    } catch (error) {
      console.error('获取文档失败:', error);
      if (error.response?.status === 404) {
        navigate('/documents');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // 获取用户标签和文件夹
  useEffect(() => {
    const fetchUserTagsAndFolders = async () => {
      try {
        setLoadingTags(true);
        setLoadingFolders(true);
        const [tagsRes, foldersRes] = await Promise.all([
          axios.get('/api/users/tags'),
          axios.get('/api/users/folders')
        ]);
        setUserTags(tagsRes.data);
        setUserFolders(foldersRes.data);
      } catch (error) {
        console.error('获取标签和文件夹失败:', error);
      } finally {
        setLoadingTags(false);
        setLoadingFolders(false);
      }
    };
    fetchUserTagsAndFolders();
  }, []);


  // 检查是否需要自动打开视频会议（从通知跳转）
  useEffect(() => {
    if (id && id !== 'new' && searchParams.get('videoConference') === 'true') {
      setVideoConferenceOpen(true);
      // 清除 URL 参数
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('videoConference');
      navigate(`/documents/${id}?${newSearchParams.toString()}`, { replace: true });
    }
  }, [id, searchParams, navigate]);

  const fetchPermissions = async () => {
    if (!id || id === 'new') return;
    try {
      setLoadingPermissions(true);
      const response = await axios.get(`/api/documents/${id}/permissions`);
      setPermissions(response.data);
    } catch (error) {
      console.error('获取权限列表失败:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const fetchComments = async () => {
    if (!id || id === 'new') return;
    try {
      const response = await axios.get(`/api/comments/document/${id}`);
      const commentsList = response.data || [];
      setComments(commentsList);
    } catch (error) {
      console.error('获取评论失败:', error);
    }
  };

  const handleOpenVersionsDialog = () => {
    setVersionsDialogOpen(true);
  };

  // 处理版本恢复后的回调
  const handleVersionRestored = ({ title: restoredTitle, content: restoredContent }) => {
    setTitle(restoredTitle);
    setContent(restoredContent || '');
  };

  // 锁定/解锁文档
  const handleLockDocument = async () => {
    if (!id || id === 'new') return;
    
    const action = isDocumentLocked ? '解锁' : '锁定';
    if (!window.confirm(`确定要${action}该文档吗？${action === '锁定' ? '锁定后所有人将无法修改文档。' : ''}`)) {
      return;
    }
    
    try {
      setLockingDocument(true);
      const response = await axios.put(`/api/documents/${id}/lock`, {
        isLocked: !isDocumentLocked
      });
      setIsDocumentLocked(response.data.isLocked);
      alert(`文档已${!isDocumentLocked ? '锁定' : '解锁'}`);
    } catch (error) {
      console.error('锁定/解锁文档失败:', error);
      alert('操作失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLockingDocument(false);
    }
  };



  const highlightCommentPosition = useCallback((comment) => {
    const quill = quillRef?.current?.getEditor();
    if (!quill || !comment.position) {
      return;
    }

    // 清除所有之前的黄色高亮标记
    const clearYellowHighlights = () => {
      const editor = quill.container.querySelector('.ql-editor');
      if (editor) {
        // 清除所有带有 comment-yellow-highlight 类的元素
        const elements = editor.querySelectorAll('.comment-yellow-highlight');
        elements.forEach(el => {
          el.style.backgroundColor = '';
          el.style.padding = '';
          el.classList.remove('comment-yellow-highlight');
          // 如果是空的span，尝试合并
          if (el.tagName === 'SPAN' && !el.style.cssText.trim() && el.children.length === 0) {
            const parent = el.parentNode;
            if (parent) {
              parent.replaceChild(window.document.createTextNode(el.textContent), el);
              parent.normalize();
            }
          }
        });
      }
    };

    // 先清除之前的标记
    clearYellowHighlights();

    // 添加黄色高亮标记到评论位置
    const [start, end] = comment.position.split('-').map(Number);
    try {
      const text = quill.getText(start, end - start);
      if (text) {
        // 使用Quill的formatText添加背景色高亮
        quill.formatText(start, end - start, 'background', '#fff3cd');
        
        // 等待Quill渲染后，通过DOM操作添加高亮类
        setTimeout(() => {
          const editor = quill.container.querySelector('.ql-editor');
          if (editor) {
            // 找到所有带有背景色的元素（Quill的背景色格式）
            const highlights = editor.querySelectorAll('[style*="background"]');
            highlights.forEach(span => {
              // 检查这个高亮是否在目标范围内
              const range = window.document.createRange();
              try {
                range.selectNodeContents(editor);
                range.setStart(editor, 0);
                const tempRange = range.cloneRange();
                tempRange.setEndBefore(span);
                const beforeLength = tempRange.toString().length;
                tempRange.setEndAfter(span);
                const afterLength = tempRange.toString().length;
                
                // 如果高亮在目标范围内且是黄色背景，添加高亮类
                if (beforeLength < end && afterLength > start) {
                  const bgColor = span.style.backgroundColor || window.getComputedStyle(span).backgroundColor;
                  if (bgColor && (bgColor.includes('243') || bgColor.includes('205') || bgColor.includes('fff3cd'))) {
                    span.classList.add('comment-yellow-highlight');
                  }
                }
              } catch (e) {
                // 如果无法计算，检查背景色后添加类
                const bgColor = span.style.backgroundColor || window.getComputedStyle(span).backgroundColor;
                if (bgColor && (bgColor.includes('243') || bgColor.includes('205') || bgColor.includes('fff3cd'))) {
                  span.classList.add('comment-yellow-highlight');
                }
              }
            });
          }
        }, 50);
        
        // 滚动到该位置（不选中文字，只滚动）
        setTimeout(() => {
          const line = quill.getLine(start);
          if (line && line[0] && line[0].domNode) {
            line[0].domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // 3秒后自动清除黄色高亮
        setTimeout(() => {
          clearYellowHighlights();
          // 同时清除Quill的背景色格式
          quill.formatText(start, end - start, 'background', false);
        }, 3000);
      }
    } catch (error) {
      console.error('标记评论位置失败:', error);
    }
  }, []);

  const searchUsers = async (query) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('搜索用户失败:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUser || !id || id === 'new') return;
    try {
      await axios.post(`/api/documents/${id}/share`, {
        userId: selectedUser.id,
        permission: selectedPermission
      });
      setShareDialogOpen(false);
      setSelectedUser(null);
      setSearchTerm('');
      fetchPermissions();
    } catch (error) {
      console.error('分享文档失败:', error);
      alert('分享失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleOpenShareDialog = () => {
    // 检查权限：只有文档创建者或管理员可以分享
    if (!document || (!user || (document.creatorId !== user.id && user.role !== 'admin'))) {
      alert('只有文档创建者和管理员可以分享文档');
      return;
    }
    setShareDialogOpen(true);
    fetchPermissions();
  };



  useEffect(() => {
    fetchDocument();
    fetchPermissions();
    if (id && id !== 'new') {
      fetchComments();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // 清理所有光标指示器
      cleanupCursors();
    };
  }, [id, fetchDocument, cleanupCursors]);


  const handleSave = async () => {
    try {
      setSaving(true);
      // 将选中的标签名称转换为逗号分隔的字符串
      const tagsString = selectedTags.length > 0 ? selectedTags.join(',') : null;
      await axios.put(`/api/documents/${id}`, {
        title,
        content,
        tags: tagsString,
        folder: selectedFolder || null
      });
      setSaving(false);
    } catch (error) {
      console.error('保存失败:', error);
      setSaving(false);
    }
  };

  const handleContentChange = (value) => {
    // 只读用户或文档被锁定不能修改内容
    if (userPermission === 'read' || isDocumentLocked) {
      return;
    }
    
    setContent(value);

    // 自动保存（防抖）
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    // 实时同步
    emitDocumentEdit(value);
  };

  const handleTitleChange = (e) => {
    // 只读用户或文档被锁定不能修改标题
    if (userPermission === 'read' || isDocumentLocked) {
      return;
    }
    
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // 实时同步标题给其他用户
    emitTitleUpdate(newTitle);
  };

  const handleTitleBlur = () => {
    handleSave();
  };

  // 获取可用用户列表（用于视频会议邀请）
  const fetchAvailableUsers = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      setLoadingUsers(true);
      const userIds = new Set();
      const userMap = new Map();
      
      // 获取文档信息和权限列表
      const [docResponse, permResponse] = await Promise.all([
        axios.get(`/api/documents/${id}`),
        axios.get(`/api/documents/${id}/permissions`)
      ]);
      
      // 添加文档创建者
      if (docResponse.data.creator) {
        userIds.add(docResponse.data.creator.id);
        userMap.set(docResponse.data.creator.id, docResponse.data.creator);
      }
      
      // 添加有权限的用户
      permResponse.data.forEach(perm => {
        if (perm.user) {
          userIds.add(perm.user.id);
          userMap.set(perm.user.id, perm.user);
        }
      });
      
      setAvailableUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error('获取用户列表失败:', error);
      // 如果失败，使用搜索用户API作为备选
      try {
        const searchRes = await axios.get('/api/users/search?q=&limit=100');
        setAvailableUsers(searchRes.data.filter(u => u.id !== user?.id));
      } catch (searchError) {
        console.error('搜索用户失败:', searchError);
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [id, user?.id]);

  // 当文档加载完成后获取用户列表（用于视频会议）
  useEffect(() => {
    if (id && id !== 'new' && document) {
      fetchAvailableUsers();
    }
  }, [id, document, fetchAvailableUsers]);

  const handleRequestPermission = async () => {
    if (!id || id === 'new' || permissionRequested) return;
    
    setRequestingPermission(true);
    try {
      await axios.post(`/api/documents/${id}/request-permission`);
      setPermissionRequested(true);
      alert('权限申请已提交，等待管理员或文档创建者审核');
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || '申请失败，请稍后重试';
      if (error.response?.status === 400) {
        // 如果已经申请过或已有权限，显示相应消息
        if (errorMessage.includes('已申请过')) {
          setPermissionRequested(true);
        }
        alert(errorMessage);
      } else {
        alert('申请失败: ' + errorMessage);
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Typography>加载中...</Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(`/documents${viewMode !== 'list' ? `?viewMode=${viewMode}` : ''}`)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <TextField
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="未命名文档"
            variant="standard"
            disabled={userPermission === 'read' || isDocumentLocked}
            sx={{
              flexGrow: 1,
              mr: 1,
              '& .MuiInputBase-root': {
                alignItems: 'center'
              },
              '& .MuiInputBase-input': {
                color: 'white',
                fontSize: '1.25rem',
                py: 0.5
              },
              '& .MuiInputBase-input:disabled': {
                color: 'rgba(255, 255, 255, 0.7)',
                WebkitTextFillColor: 'rgba(255, 255, 255, 0.7)'
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'rgba(255, 255, 255, 0.5)',
                opacity: 1
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <AvatarGroup max={4} sx={{ alignItems: 'center' }}>
              {editors.map((editor) => (
                <Avatar 
                  key={editor.id} 
                  sx={{ width: 32, height: 32 }}
                  src={editor.avatar ? (editor.avatar.startsWith('http') ? editor.avatar : `http://127.0.0.1:3001${editor.avatar}`) : undefined}
                  title={editor.nickname || editor.username}
                >
                  {editor.nickname?.[0] || editor.username?.[0] || <PersonIcon />}
                </Avatar>
              ))}
            </AvatarGroup>
            {editors.length > 0 && (
              <Typography variant="caption" sx={{ ml: 1, color: 'inherit', lineHeight: 1.5 }}>
                {editors.length} 人在编辑
              </Typography>
            )}
          </Box>
          <Chip
            label={saving ? '保存中...' : '已保存'}
            color={saving ? 'warning' : 'success'}
            size="small"
            sx={{ mr: 1, height: 'fit-content' }}
          />
          {document && user && (document.creatorId === user.id || user.role === 'admin') && (
            <Button
              color="inherit"
              startIcon={<ShareIcon />}
              onClick={handleOpenShareDialog}
              sx={{ mr: 1 }}
            >
              分享
            </Button>
          )}
          <Button
            color="inherit"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || userPermission === 'read' || isDocumentLocked}
            sx={{ mr: 1 }}
          >
            保存
          </Button>
          {/* 锁定/解锁文档按钮（仅创建者和管理员可见） */}
          {document && (document.creatorId === user?.id || user?.role === 'admin') && (
            <IconButton
              color="inherit"
              onClick={handleLockDocument}
              disabled={lockingDocument}
              title={isDocumentLocked ? '解锁文档' : '锁定文档'}
              sx={{ mr: 0.5 }}
            >
              {lockingDocument ? (
                <CircularProgress size={20} />
              ) : isDocumentLocked ? (
                <LockIcon />
              ) : (
                <LockOpenIcon />
              )}
            </IconButton>
          )}
          <IconButton
            color="inherit"
            onClick={() => setTasksPanelOpen(!tasksPanelOpen)}
            title={tasksPanelOpen ? "隐藏任务" : "显示任务"}
            sx={{ ml: 0.5 }}
          >
            <AssignmentIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => setCommentsPanelOpen(!commentsPanelOpen)}
            title={commentsPanelOpen ? "隐藏评论" : "显示评论"}
            sx={{ ml: 0.5 }}
          >
            <CommentIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => setVideoConferenceOpen(true)}
            title="视频会议"
            sx={{ ml: 0.5 }}
          >
            <VideocamIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={handleOpenVersionsDialog}
            title="版本历史"
            sx={{ ml: 0.5 }}
          >
            <HistoryIcon />
          </IconButton>
          <Box sx={{ ml: 0.5, display: 'flex', gap: 0.5, borderLeft: 1, borderColor: 'divider', pl: 0.5 }}>
            <IconButton
              color="inherit"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const quill = quillRef.current?.getEditor();
                if (quill && quill.history) {
                  quill.history.undo();
                }
              }}
              title="撤销 (Ctrl+Z)"
              disabled={userPermission === 'read' || isDocumentLocked}
            >
              <UndoIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const quill = quillRef.current?.getEditor();
                if (quill && quill.history) {
                  quill.history.redo();
                }
              }}
              title="重做 (Ctrl+Y 或 Ctrl+Shift+Z)"
              disabled={userPermission === 'read' || isDocumentLocked}
            >
              <RedoIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => setSearchOpen(!searchOpen)}
              title="搜索 (Ctrl+F)"
            >
              <SearchIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 搜索框 */}
      {searchOpen && (
        <Paper
          sx={{
            p: 1.5,
            mx: 2,
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider'
          }}
        >
          <SearchIcon color="action" />
          <TextField
            autoFocus
            size="small"
            placeholder="搜索文档内容..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                navigateToPreviousMatch();
              } else if (e.key === 'Enter') {
                navigateToNextMatch();
              }
            }}
            sx={{ flexGrow: 1 }}
            InputProps={{
              endAdornment: searchKeyword && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {searchMatches.length > 0
                      ? `${currentMatchIndex + 1} / ${searchMatches.length}`
                      : '0 / 0'}
                  </Typography>
                </Box>
              )
            }}
          />
          {searchMatches.length > 0 && (
            <>
              <IconButton
                size="small"
                onClick={navigateToPreviousMatch}
                title="上一个 (Shift+Enter)"
              >
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={navigateToNextMatch}
                title="下一个 (Enter)"
              >
                <NavigateNextIcon />
              </IconButton>
            </>
          )}
          <IconButton
            size="small"
            onClick={closeSearch}
            title="关闭 (Esc)"
          >
            <CloseSearchIcon />
          </IconButton>
        </Paper>
      )}

      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', height: '100%' }}>
        {/* 左侧任务面板 */}
        {tasksPanelOpen && (
          <TasksPanel 
            documentId={id && id !== 'new' ? parseInt(id) : null}
            userPermission={userPermission}
          />
        )}
        
        <Box sx={{ flexGrow: 1, overflow: 'auto', minWidth: 0 }}>
          <Container maxWidth="lg" sx={{ mt: 3, mb: 3 }}>
            <Paper sx={{ p: 3, minHeight: '70vh' }}>
            <Box 
              sx={{ 
                position: 'relative',
                width: '100%',
                '& > .ql-container': {
                  position: 'relative',
                  border: '1px solid rgba(0, 0, 0, 0.12) !important',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  width: '100%',
                  maxWidth: '100%'
                },
                '& .ql-toolbar': {
                  border: 'none !important',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12) !important',
                  borderRadius: '4px 4px 0 0',
                  boxSizing: 'border-box',
                  width: '100%'
                },
                '& .ql-editor': {
                  border: 'none !important',
                  borderRadius: '0 0 4px 4px',
                  boxSizing: 'border-box',
                  width: '100%'
                },
                '& .ql-snow': {
                  width: '100%',
                  boxSizing: 'border-box'
                }
              }}
            >
              {userPermission === 'read' && (
                <Alert 
                  severity="info" 
                  sx={{ mb: 2 }}
                  action={
                    !isDocumentLocked && !permissionRequested ? (
                      <Button
                        color="inherit"
                        size="small"
                        onClick={handleRequestPermission}
                        disabled={requestingPermission}
                      >
                        {requestingPermission ? '申请中...' : '申请编辑权限'}
                      </Button>
                    ) : !isDocumentLocked && permissionRequested ? (
                      <Typography variant="caption" color="text.secondary">
                        已申请，等待审核
                      </Typography>
                    ) : null
                  }
                >
                  {isDocumentLocked ? '文档已锁定，所有人无法编辑此文档' : '您只有只读权限，无法编辑此文档'}
                </Alert>
              )}
              {/* 标签和文件夹选择 */}
              {userPermission !== 'read' && !isDocumentLocked && (
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>文件夹</InputLabel>
                    <Select
                      value={selectedFolder || ''}
                      onChange={(e) => setSelectedFolder(e.target.value || null)}
                      label="文件夹"
                      disabled={loadingFolders}
                    >
                      <MenuItem value="">
                        <em>无</em>
                      </MenuItem>
                      {userFolders.map((folder) => (
                        <MenuItem key={folder.id} value={folder.name}>
                          {folder.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Autocomplete
                    multiple
                    size="small"
                    options={userTags.map(tag => tag.name)}
                    value={selectedTags}
                    onChange={(event, newValue) => {
                      setSelectedTags(newValue);
                    }}
                    disabled={loadingTags}
                    sx={{ minWidth: 300, flexGrow: 1 }}
                    renderInput={(params) => (
                      <TextField {...params} label="标签" placeholder="选择或输入标签" size="small" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          {...getTagProps({ index })}
                          key={option}
                          size="small"
                        />
                      ))
                    }
                    freeSolo
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        const newTag = e.target.value.trim();
                        if (newTag && !selectedTags.includes(newTag)) {
                          setSelectedTags([...selectedTags, newTag]);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </Box>
              )}
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={handleContentChange}
                readOnly={userPermission === 'read' || isDocumentLocked}
                onChangeSelection={(selection) => {
                  // 发送光标位置更新（包括自己的）
                  if (id !== 'new' && selection) {
                    // 立即更新本地光标显示
                    const currentPosition = selection.index || 0;
                    setOtherUsersCursors(prev => ({
                      ...prev,
                      [user.id]: { 
                        position: currentPosition, 
                        selection: selection, 
                        timestamp: Date.now() 
                      }
                    }));
                    // 立即更新光标指示器
                    updateCursorIndicator(user.id, currentPosition, selection);
                    
                    // 发送给其他用户
                    // 立即发送光标更新
                    emitCursorUpdate(currentPosition, selection);
                  }
                }}
                onScroll={() => {
                  // 滚动时立即更新所有光标指示器位置
                  Object.entries(otherUsersCursors).forEach(([userId, cursorInfo]) => {
                    updateCursorIndicator(userId, cursorInfo.position, cursorInfo.selection);
                  });
                }}
                style={{ height: '53vh' }}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ],
                  history: {
                    delay: 1000,
                    maxStack: 100,
                    userOnly: false
                  }
                }}
              />
              {/* 光标指示器通过 DOM 操作直接添加到编辑器中 */}
            </Box>
          </Paper>
        </Container>
      </Box>
      {/* 评论面板 - 固定在右侧 */}
      {commentsPanelOpen && (
        <Box sx={{ 
          width: 400, 
          borderLeft: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }}>
          <CommentsPanel
            documentId={id && id !== 'new' ? parseInt(id) : null}
            quillRef={quillRef}
            comments={comments}
            onCommentsChange={fetchComments}
            selectedCommentId={selectedCommentId}
            onCommentSelect={(commentId) => {
              setSelectedCommentId(commentId);
              // 点击评论时，在文档中标记对应位置（下划线）
              const comment = comments.find(c => c.id === commentId);
              if (comment) {
                highlightCommentPosition(comment);
              }
            }}
            onCommentAdded={() => {
              fetchComments();
            }}
          />
        </Box>
      )}
    </Box>

    {/* 分享对话框 */}
    <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">分享文档</Typography>
            <IconButton
              aria-label="关闭"
              onClick={() => {
                setShareDialogOpen(false);
                setSelectedUser(null);
                setSearchTerm('');
              }}
              sx={{ ml: 2 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              搜索并添加用户，为其设置文档访问权限
            </Typography>
            <Autocomplete
              options={searchResults}
              getOptionLabel={(option) => `${option.nickname || option.username} (${option.email})`}
              loading={searching}
              onInputChange={(event, value) => {
                setSearchTerm(value);
                searchUsers(value);
              }}
              onChange={(event, value) => {
                setSelectedUser(value);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="搜索用户"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searching ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>权限类型</InputLabel>
              <Select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value)}
                label="权限类型"
              >
                <MenuItem value="read">查看者（只读）</MenuItem>
                <MenuItem value="write">编辑者（可编辑）</MenuItem>
                <MenuItem value="admin">管理员（可管理权限）</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShareDialogOpen(false);
            setSelectedUser(null);
            setSearchTerm('');
          }}>取消</Button>
          <Button onClick={handleShare} variant="contained" disabled={!selectedUser}>
            分享
          </Button>
        </DialogActions>
      </Dialog>

      {/* 版本历史对话框 */}
      <VersionHistoryDialog
        open={versionsDialogOpen}
        onClose={() => setVersionsDialogOpen(false)}
        documentId={id && id !== 'new' ? parseInt(id) : null}
        userPermission={userPermission}
        isDocumentLocked={isDocumentLocked}
        onVersionRestored={handleVersionRestored}
      />

      {/* 视频会议组件 */}
      {id && id !== 'new' && (
        <VideoConference
          documentId={id}
          isOpen={videoConferenceOpen}
          onClose={() => setVideoConferenceOpen(false)}
          socket={socket}
          participants={editors}
          availableMembers={availableUsers}
        />
      )}
    </Box>
  );
};

export default DocumentEditor;

