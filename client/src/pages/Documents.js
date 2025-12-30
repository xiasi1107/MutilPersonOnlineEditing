import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  AppBar,
  Toolbar,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Avatar,
  IconButton as MuiIconButton,
  Checkbox,
  Autocomplete,
  Paper,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  Description as DocumentIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as TemplateIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  ViewList as ViewListIcon,
  Folder as FolderIcon,
  Label as LabelIcon,
  FolderOpen as FolderOpenIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Share as ShareIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// 去除HTML标签，只保留纯文本
const stripHtmlTags = (html) => {
  if (!html) return '';
  // 创建一个临时div元素来解析HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // 获取纯文本内容
  return tmp.textContent || tmp.innerText || '';
};

const Documents = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCreator, setSelectedCreator] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [creators, setCreators] = useState([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  // 视图模式状态
  const [viewMode, setViewMode] = useState('list');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [userTags, setUserTags] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  // 多选相关状态
  const [isBatchShareMode, setIsBatchShareMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [batchShareDialogOpen, setBatchShareDialogOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState([]);
  const [sharePermission, setSharePermission] = useState('read');
  const [searchUserResults, setSearchUserResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sharingDocuments, setSharingDocuments] = useState(false);

  // 检查是否有删除权限
  const canDeleteDocument = (doc) => {
    if (!user) return false;
    // 管理员可以删除所有文档
    if (user.role === 'admin') return true;
    // 创建者可以删除自己的文档
    return doc.creatorId === user.id;
  };

  // 检查是否有权限管理权限
  const canManagePermissions = (doc) => {
    if (!user) return false;
    // 管理员可以管理所有文档的权限
    if (user.role === 'admin') return true;
    // 创建者可以管理自己文档的权限
    return doc.creatorId === user.id;
  };

  // 多选相关函数
  const handleToggleSelectDocument = (docId) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocuments(newSelected);
  };


  // 进入批量分享模式
  const handleEnterBatchShareMode = () => {
    setIsBatchShareMode(true);
    setSelectedDocuments(new Set());
  };

  // 退出批量分享模式
  const handleExitBatchShareMode = () => {
    setIsBatchShareMode(false);
    setSelectedDocuments(new Set());
  };

  const handleOpenBatchShareDialog = () => {
    if (selectedDocuments.size === 0) {
      alert('请先选择要分享的文档');
      return;
    }
    setBatchShareDialogOpen(true);
    setShareUsers([]);
    setSharePermission('read');
  };

  // 搜索用户
  const handleSearchUsers = async (query) => {
    if (!query || query.length < 1) {
      setSearchUserResults([]);
      return;
    }
    try {
      setLoadingUsers(true);
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`);
      // 排除当前用户
      const filteredUsers = response.data.filter(u => u.id !== user?.id);
      setSearchUserResults(filteredUsers);
    } catch (error) {
      console.error('搜索用户失败:', error);
      setSearchUserResults([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 批量分享文档
  const handleBatchShare = async () => {
    if (selectedDocuments.size === 0 || shareUsers.length === 0) {
      alert('请选择要分享的文档和用户');
      return;
    }

    setSharingDocuments(true);
    try {
      const documentIds = Array.from(selectedDocuments);
      const userIds = shareUsers.map(u => u.id);
      
      // 为每个文档和每个用户创建分享
      const promises = [];
      for (const docId of documentIds) {
        for (const userId of userIds) {
          promises.push(
            axios.post(`/api/documents/${docId}/share`, {
              userId: userId,
              permission: sharePermission
            }).catch(error => {
              console.error(`分享文档 ${docId} 给用户 ${userId} 失败:`, error);
              return { error: error.response?.data?.detail || error.message };
            })
          );
        }
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r?.error);
      
      if (errors.length > 0) {
        alert(`部分分享失败: ${errors.map(e => e.error).join(', ')}`);
      } else {
        alert(`成功分享 ${documentIds.length} 个文档给 ${userIds.length} 个用户`);
      }

      setBatchShareDialogOpen(false);
      setSelectedDocuments(new Set());
      setShareUsers([]);
    } catch (error) {
      console.error('批量分享失败:', error);
      alert('批量分享失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSharingDocuments(false);
    }
  };

  // 打开权限管理对话框
  const handleOpenPermissionDialog = (e, doc) => {
    e.stopPropagation(); // 阻止事件冒泡
    setSelectedDocument(doc);
    setPermissionDialogOpen(true);
    fetchDocumentPermissions(doc.id);
  };

  // 获取文档权限列表
  const fetchDocumentPermissions = async (documentId) => {
    try {
      setLoadingPermissions(true);
      const response = await axios.get(`/api/documents/${documentId}/permissions`);
      setPermissions(response.data);
    } catch (error) {
      console.error('获取权限列表失败:', error);
      alert('获取权限列表失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingPermissions(false);
    }
  };

  // 更新权限
  const handleUpdatePermission = async (permissionId, newPermission) => {
    if (!selectedDocument) return;
    try {
      const perm = permissions.find(p => p.id === permissionId);
      await axios.put(`/api/documents/${selectedDocument.id}/permissions/${permissionId}`, {
        userId: perm.userId,
        permission: newPermission
      });
      fetchDocumentPermissions(selectedDocument.id);
    } catch (error) {
      alert('更新权限失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 删除权限
  const handleDeletePermission = async (permissionId) => {
    if (!selectedDocument) return;
    const perm = permissions.find(p => p.id === permissionId);
    if (window.confirm(`确定要移除 ${perm.user?.nickname || perm.user?.username} 的权限吗？`)) {
      try {
        await axios.delete(`/api/documents/${selectedDocument.id}/permissions/${permissionId}`);
        fetchDocumentPermissions(selectedDocument.id);
      } catch (error) {
        alert('删除权限失败: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  // 从 URL 参数读取视图模式（在组件挂载和 URL 变化时）- 必须在其他 useEffect 之前
  useEffect(() => {
    const mode = searchParams.get('viewMode');
    console.log('Documents: URL viewMode =', mode);
    if (mode && ['list', 'folder', 'tag'].includes(mode)) {
      console.log('Documents: Setting viewMode to', mode);
      setViewMode(mode);
    } else if (!mode) {
      // 如果没有 viewMode 参数，默认使用列表视图
      console.log('Documents: No viewMode in URL, using default "list"');
      setViewMode('list');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDocuments();
    fetchCreators();
    fetchUserTags();
    fetchUserFolders();
  }, []);

  // 当文件夹管理对话框打开时，刷新文件夹列表
  useEffect(() => {
    if (foldersDialogOpen) {
      fetchUserFolders();
    }
  }, [foldersDialogOpen]);

  // 当切换到文件夹视图时，刷新文件夹列表
  useEffect(() => {
    if (viewMode === 'folder') {
      fetchUserFolders();
    }
  }, [viewMode]);

  // 当标签管理对话框打开时，刷新标签列表
  useEffect(() => {
    if (tagsDialogOpen) {
      fetchUserTags();
    }
  }, [tagsDialogOpen]);

  // 获取用户标签
  const fetchUserTags = async () => {
    try {
      setLoadingTags(true);
      const response = await axios.get('/api/users/tags');
      setUserTags(response.data);
    } catch (error) {
      console.error('获取标签列表失败:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  // 获取用户文件夹
  const fetchUserFolders = async () => {
    try {
      setLoadingFolders(true);
      const response = await axios.get('/api/users/folders');
      console.log('获取文件夹列表成功:', response.data);
      setUserFolders(response.data || []);
    } catch (error) {
      console.error('获取文件夹列表失败:', error);
      setUserFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  // 创建标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('请输入标签名称');
      return;
    }
    try {
      const response = await axios.post('/api/users/tags', { name: newTagName.trim() });
      console.log('创建标签成功:', response.data);
      setNewTagName('');
      await fetchUserTags();
    } catch (error) {
      console.error('创建标签失败:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || '创建标签失败';
      alert('创建标签失败: ' + errorMessage);
    }
  };

  // 更新标签
  const handleUpdateTag = async (tagId, newName) => {
    if (!newName.trim()) return;
    try {
      await axios.put(`/api/users/tags/${tagId}`, { name: newName.trim() });
      setEditingTag(null);
      fetchUserTags();
    } catch (error) {
      alert('更新标签失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId) => {
    if (!window.confirm('确定要删除这个标签吗？')) return;
    try {
      await axios.delete(`/api/users/tags/${tagId}`);
      fetchUserTags();
    } catch (error) {
      alert('删除标签失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 创建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('请输入文件夹名称');
      return;
    }
    try {
      const response = await axios.post('/api/users/folders', { name: newFolderName.trim() });
      console.log('创建文件夹成功:', response.data);
      setNewFolderName('');
      await fetchUserFolders();
    } catch (error) {
      console.error('创建文件夹失败:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || '创建文件夹失败';
      alert('创建文件夹失败: ' + errorMessage);
      // 即使创建失败，也刷新列表以显示已存在的文件夹
      await fetchUserFolders();
    }
  };

  // 更新文件夹
  const handleUpdateFolder = async (folderId, newName) => {
    if (!newName.trim()) return;
    try {
      await axios.put(`/api/users/folders/${folderId}`, { name: newName.trim() });
      setEditingFolder(null);
      fetchUserFolders();
    } catch (error) {
      alert('更新文件夹失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 删除文件夹
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('确定要删除这个文件夹吗？')) return;
    try {
      await axios.delete(`/api/users/folders/${folderId}`);
      fetchUserFolders();
    } catch (error) {
      alert('删除文件夹失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/documents');
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('获取文档列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取创建者列表
  const fetchCreators = async () => {
    try {
      setLoadingCreators(true);
      // 从文档列表中提取所有创建者
      const response = await axios.get('/api/documents');
      const allDocs = response.data.documents;
      const creatorMap = new Map();
      allDocs.forEach(doc => {
        if (doc.creator && !creatorMap.has(doc.creator.id)) {
          creatorMap.set(doc.creator.id, doc.creator);
        }
      });
      setCreators(Array.from(creatorMap.values()));
    } catch (error) {
      console.error('获取创建者列表失败:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      let url = '/api/documents?';
      const params = [];
      if (searchTerm) {
        params.push(`search=${encodeURIComponent(searchTerm)}`);
      }
      if (selectedCreator) {
        params.push(`creatorId=${selectedCreator}`);
      }
      if (dateFrom) {
        params.push(`dateFrom=${dateFrom}`);
      }
      if (dateTo) {
        params.push(`dateTo=${dateTo}`);
      }
      url += params.join('&');
      const response = await axios.get(url);
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSelectedCreator('');
    setDateFrom('');
    setDateTo('');
    fetchDocuments();
  };

  // 按文件夹组织文档（只显示当前用户的文件夹）
  const getDocumentsByFolder = () => {
    const folderMap = new Map();
    const noFolder = [];
    
    // 获取当前用户的文件夹名称列表
    const userFolderNames = new Set((userFolders || []).map(f => f.name));
    
    documents.forEach(doc => {
      if (doc.folder && userFolderNames.has(doc.folder)) {
        // 只处理属于用户文件夹的文档
        if (!folderMap.has(doc.folder)) {
          folderMap.set(doc.folder, []);
        }
        folderMap.get(doc.folder).push(doc);
      } else {
        // 文档没有文件夹，或者文件夹不属于当前用户
        noFolder.push(doc);
      }
    });
    
    return { folderMap, noFolder };
  };

  // 按标签组织文档（只显示当前用户的标签）
  const getDocumentsByTag = () => {
    const tagMap = new Map();
    const noTag = [];
    
    // 获取当前用户的标签名称列表
    const userTagNames = new Set((userTags || []).map(t => t.name));
    
    documents.forEach(doc => {
      if (doc.tags) {
        const tags = doc.tags.split(',').map(t => t.trim()).filter(t => t);
        // 只保留属于用户标签的标签
        const userTagsInDoc = tags.filter(tag => userTagNames.has(tag));
        
        if (userTagsInDoc.length > 0) {
          userTagsInDoc.forEach(tag => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, []);
            }
            tagMap.get(tag).push(doc);
          });
        } else {
          // 文档的标签都不属于当前用户，或者没有标签
          noTag.push(doc);
        }
      } else {
        noTag.push(doc);
      }
    });
    
    return { tagMap, noTag };
  };

  const handleCreateDocument = async (templateId = null) => {
    try {
      let response;
      if (templateId) {
        // 使用模板创建文档
        response = await axios.post(`/api/templates/${templateId}/create-document`);
      } else {
        // 创建空白文档
        response = await axios.post('/api/documents', {
          title: '',
          content: ''
        });
      }
      navigate(`/documents/${response.data.document.id}?viewMode=${viewMode}`);
      setTemplateDialogOpen(false);
    } catch (error) {
      console.error('创建文档失败:', error);
      alert('创建文档失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleOpenTemplateDialog = async () => {
    setTemplateDialogOpen(true);
    await fetchTemplates();
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await axios.get('/api/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('获取模板列表失败:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleDeleteClick = (e, document) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      await axios.delete(`/api/documents/${documentToDelete.id}`);
      // 删除成功后刷新列表
      fetchDocuments();
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('删除文档失败:', error);
      alert('删除文档失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            文档列表
          </Typography>
          <Button
            color="inherit"
            startIcon={<ShareIcon />}
            onClick={handleEnterBatchShareMode}
            sx={{ mr: 1 }}
            variant={isBatchShareMode ? 'contained' : 'outlined'}
          >
            批量分享
          </Button>
          {user?.role === 'admin' && (
            <Button
              color="inherit"
              startIcon={<PersonIcon />}
              onClick={() => navigate('/users')}
              sx={{ mr: 1 }}
            >
              用户管理
            </Button>
          )}
          <Button
            color="inherit"
            startIcon={<AddIcon />}
            onClick={handleOpenTemplateDialog}
          >
            新建文档
          </Button>
          <Box sx={{ ml: 2, display: 'flex', gap: 0.5 }}>
     <Button
       variant={viewMode === 'list' ? 'contained' : 'outlined'}
       color={viewMode === 'list' ? 'primary' : 'inherit'}
       onClick={() => {
         setViewMode('list');
         setSelectedFolder(null);
         setSearchParams({ viewMode: 'list' });
       }}
       startIcon={<ViewListIcon />}
     >
       列表
     </Button>
     <Button
       variant={viewMode === 'folder' ? 'contained' : 'outlined'}
       color={viewMode === 'folder' ? 'primary' : 'inherit'}
       onClick={() => {
         setViewMode('folder');
         setSelectedFolder(null);
         setSearchParams({ viewMode: 'folder' });
       }}
       startIcon={<FolderIcon />}
     >
       文件夹
     </Button>
     <Button
       variant={viewMode === 'tag' ? 'contained' : 'outlined'}
       color={viewMode === 'tag' ? 'primary' : 'inherit'}
       onClick={() => {
         setViewMode('tag');
         setSelectedFolder(null);
         setSearchParams({ viewMode: 'tag' });
       }}
       startIcon={<LabelIcon />}
     >
       标签
     </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="搜索文档标题或内容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Select
                fullWidth
                value={selectedCreator}
                onChange={(e) => setSelectedCreator(e.target.value)}
                displayEmpty
                disabled={loadingCreators}
              >
                <MenuItem value="">全部创建者</MenuItem>
                {creators.map((creator) => (
                  <MenuItem key={creator.id} value={creator.id}>
                    {creator.nickname || creator.username}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="开始日期"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="结束日期"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  startIcon={<SearchIcon />}
                  fullWidth
                >
                  搜索
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleClearSearch}
                  fullWidth
                >
                  清除
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {loading ? (
          <Typography>加载中...</Typography>
        ) : documents.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              暂无文档
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenTemplateDialog}
              sx={{ mt: 2 }}
            >
              创建第一个文档
            </Button>
          </Box>
        ) : (
          <>
            {/* 批量操作工具栏 */}
            {isBatchShareMode && (
              <Paper
                elevation={2}
                sx={{
                  p: 2,
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: selectedDocuments.size > 0 ? 'primary.main' : 'grey.200',
                  color: selectedDocuments.size > 0 ? 'primary.contrastText' : 'text.primary'
                }}
              >
                <Typography variant="body1">
                  {selectedDocuments.size > 0 
                    ? `已选择 ${selectedDocuments.size} 个文档` 
                    : '请选择要分享的文档'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedDocuments.size > 0 && (
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<ShareIcon />}
                      onClick={handleOpenBatchShareDialog}
                    >
                      分享选中文档
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color={selectedDocuments.size > 0 ? 'inherit' : 'primary'}
                    onClick={handleExitBatchShareMode}
                  >
                    退出批量分享
                  </Button>
                </Box>
              </Paper>
            )}
            {viewMode === 'list' && (
              <Grid container spacing={3}>
                {documents.map((doc) => {
                  const canManage = canManagePermissions(doc);
                  const isSelected = selectedDocuments.has(doc.id);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={doc.id}>
                      <Card
                        sx={{ 
                          cursor: 'pointer', 
                          height: '100%', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          '&:hover': { boxShadow: 4 },
                          border: isSelected ? 2 : 0,
                          borderColor: isSelected ? 'primary.main' : 'transparent'
                        }}
                      >
                        {isBatchShareMode && canManage && (
                          <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelectDocument(doc.id);
                              }}
                              icon={<CheckBoxOutlineBlankIcon />}
                              checkedIcon={<CheckBoxIcon />}
                              size="small"
                              sx={{ color: 'primary.main' }}
                            />
                          </Box>
                        )}
                        <CardContent 
                          sx={{ flexGrow: 1, cursor: 'pointer', pt: canManage ? 0 : 2 }}
                          onClick={() => navigate(`/documents/${doc.id}?viewMode=${viewMode}`)}
                        >
                        <Box display="flex" alignItems="center" mb={1}>
                          <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                            {doc.title || '未命名文档'}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {doc.content ? stripHtmlTags(doc.content).substring(0, 150) : '空文档'}
                          {doc.content && stripHtmlTags(doc.content).length > 150 ? '...' : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          创建者: {doc.creator?.nickname || doc.creator?.username} | 
                          更新于: {new Date(doc.updatedAt).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                      <CardActions sx={{ justifyContent: 'flex-end', p: 1, gap: 0.5 }}>
                        {canManagePermissions(doc) && (
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => handleOpenPermissionDialog(e, doc)}
                            title="权限管理"
                          >
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDeleteDocument(doc) && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteClick(e, doc)}
                            title="删除文档"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                  );
                })}
              </Grid>
            )}

            {viewMode === 'folder' && (() => {
              const { folderMap, noFolder } = getDocumentsByFolder();
              // 只显示当前用户的文件夹，按名称排序
              const userFolderNames = (userFolders || []).map(f => f.name).sort();
              
              // 如果选中了某个文件夹，显示该文件夹下的文档
              if (selectedFolder) {
                const folderDocs = folderMap.get(selectedFolder) || [];
                return (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <IconButton
                        onClick={() => setSelectedFolder(null)}
                        sx={{ mr: 1 }}
                        size="small"
                      >
                        <ArrowBackIcon />
                      </IconButton>
                      <FolderOpenIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>
                        {selectedFolder}
                      </Typography>
                      <Chip label={`${folderDocs.length} 个文档`} size="small" />
                    </Box>
                    
                    {folderDocs.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          该文件夹下暂无文档
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={3}>
                        {folderDocs.map((doc) => {
                          const canManage = canManagePermissions(doc);
                          const isSelected = selectedDocuments.has(doc.id);
                          return (
                            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                              <Card
                                sx={{ 
                                  cursor: 'pointer', 
                                  height: '100%', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  '&:hover': { boxShadow: 4 },
                                  border: isSelected ? 2 : 0,
                                  borderColor: isSelected ? 'primary.main' : 'transparent'
                                }}
                              >
                                {isBatchShareMode && canManage && (
                                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelectDocument(doc.id);
                                      }}
                                      icon={<CheckBoxOutlineBlankIcon />}
                                      checkedIcon={<CheckBoxIcon />}
                                      size="small"
                                      sx={{ color: 'primary.main' }}
                                    />
                                  </Box>
                                )}
                                <CardContent 
                                  sx={{ flexGrow: 1, cursor: 'pointer', pt: (isBatchShareMode && canManage) ? 0 : 2 }}
                                  onClick={() => navigate(`/documents/${doc.id}?viewMode=${viewMode}`)}
                                >
                                  <Box display="flex" alignItems="center" mb={1}>
                                    <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                    <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                                      {doc.title || '未命名文档'}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {doc.content ? stripHtmlTags(doc.content).substring(0, 150) : '空文档'}
                                    {doc.content && stripHtmlTags(doc.content).length > 150 ? '...' : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    创建者: {doc.creator?.nickname || doc.creator?.username} | 
                                    更新于: {new Date(doc.updatedAt).toLocaleDateString()}
                                  </Typography>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end', p: 1, gap: 0.5 }}>
                                  {canManagePermissions(doc) && (
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={(e) => handleOpenPermissionDialog(e, doc)}
                                      title="权限管理"
                                    >
                                      <SettingsIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                  {canDeleteDocument(doc) && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => handleDeleteClick(e, doc)}
                                      title="删除文档"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </CardActions>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </Box>
                );
              }
              
              // 显示文件夹列表（卡片形式）
              return (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      我的文件夹 ({userFolderNames.length} 个)
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => setFoldersDialogOpen(true)}
                      startIcon={<FolderIcon />}
                    >
                      管理我的文件夹
                    </Button>
                  </Box>
                  {userFolderNames.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        您还没有创建任何文件夹
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setFoldersDialogOpen(true)}
                        sx={{ mt: 2 }}
                      >
                        创建文件夹
                      </Button>
                    </Box>
                  ) : (
                    <Grid container spacing={3}>
                      {userFolderNames.map((folderName) => {
                        const folderDocs = folderMap.get(folderName) || [];
                        return (
                          <Grid item xs={12} sm={6} md={4} key={folderName}>
                            <Card
                              sx={{ 
                                cursor: 'pointer', 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onClick={() => setSelectedFolder(folderName)}
                            >
                              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                  <FolderOpenIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
                                  <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" component="h2" noWrap>
                                      {folderName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {folderDocs.length} 个文档
                                    </Typography>
                                  </Box>
                                </Box>
                                {folderDocs.length > 0 && (
                                  <Box sx={{ mt: 'auto' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      点击查看文档
                                    </Typography>
                                  </Box>
                                )}
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}
                  {noFolder.length > 0 && (
                    <Box sx={{ mt: 6, mb: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <FolderIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="h5" component="h2">
                          未分类
                        </Typography>
                        <Chip label={`${noFolder.length} 个文档`} size="small" sx={{ ml: 2 }} />
                      </Box>
                      <Grid container spacing={3}>
                        {noFolder.map((doc) => {
                          const canManage = canManagePermissions(doc);
                          const isSelected = selectedDocuments.has(doc.id);
                          return (
                            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                              <Card
                                sx={{ 
                                  cursor: 'pointer', 
                                  height: '100%', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  '&:hover': { boxShadow: 4 },
                                  border: isSelected ? 2 : 0,
                                  borderColor: isSelected ? 'primary.main' : 'transparent'
                                }}
                              >
                                {isBatchShareMode && canManage && (
                                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelectDocument(doc.id);
                                      }}
                                      icon={<CheckBoxOutlineBlankIcon />}
                                      checkedIcon={<CheckBoxIcon />}
                                      size="small"
                                      sx={{ color: 'primary.main' }}
                                    />
                                  </Box>
                                )}
                                <CardContent 
                                  sx={{ flexGrow: 1, cursor: 'pointer', pt: (isBatchShareMode && canManage) ? 0 : 2 }}
                                  onClick={() => navigate(`/documents/${doc.id}?viewMode=${viewMode}`)}
                                >
                                <Box display="flex" alignItems="center" mb={1}>
                                  <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                  <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                                    {doc.title || '未命名文档'}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {doc.content ? stripHtmlTags(doc.content).substring(0, 150) : '空文档'}
                                  {doc.content && stripHtmlTags(doc.content).length > 150 ? '...' : ''}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  创建者: {doc.creator?.nickname || doc.creator?.username} | 
                                  更新于: {new Date(doc.updatedAt).toLocaleDateString()}
                                </Typography>
                              </CardContent>
                              <CardActions sx={{ justifyContent: 'flex-end', p: 1, gap: 0.5 }}>
                                {canManagePermissions(doc) && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => handleOpenPermissionDialog(e, doc)}
                                    title="权限管理"
                                  >
                                    <SettingsIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {canDeleteDocument(doc) && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => handleDeleteClick(e, doc)}
                                    title="删除文档"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </CardActions>
                            </Card>
                          </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}
                </Box>
              );
            })()}

            {viewMode === 'tag' && (() => {
              const { tagMap, noTag } = getDocumentsByTag();
              // 只显示当前用户的标签，按名称排序
              const userTagNames = (userTags || []).map(t => t.name).sort();
              // 只显示有文档的标签
              const tagsWithDocs = userTagNames.filter(tag => tagMap.has(tag));
              
              return (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      我的标签 ({userTagNames.length} 个，{tagsWithDocs.length} 个有文档)
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => setTagsDialogOpen(true)}
                      startIcon={<LabelIcon />}
                    >
                      管理我的标签
                    </Button>
                  </Box>
                  {userTagNames.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        您还没有创建任何标签
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setTagsDialogOpen(true)}
                        sx={{ mt: 2 }}
                      >
                        创建标签
                      </Button>
                    </Box>
                  ) : (
                    <>
                      {tagsWithDocs.map((tag) => (
                    <Box key={tag} sx={{ mb: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LabelIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Chip label={tag} color="primary" sx={{ mr: 1 }} />
                        <Chip label={`${tagMap.get(tag).length} 个文档`} size="small" />
                      </Box>
                      <Grid container spacing={3}>
                        {tagMap.get(tag).map((doc) => {
                          const canManage = canManagePermissions(doc);
                          const isSelected = selectedDocuments.has(doc.id);
                          return (
                            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                              <Card
                                sx={{ 
                                  cursor: 'pointer', 
                                  height: '100%', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  '&:hover': { boxShadow: 4 },
                                  border: isSelected ? 2 : 0,
                                  borderColor: isSelected ? 'primary.main' : 'transparent'
                                }}
                              >
                                {isBatchShareMode && canManage && (
                                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelectDocument(doc.id);
                                      }}
                                      icon={<CheckBoxOutlineBlankIcon />}
                                      checkedIcon={<CheckBoxIcon />}
                                      size="small"
                                      sx={{ color: 'primary.main' }}
                                    />
                                  </Box>
                                )}
                                <CardContent 
                                  sx={{ flexGrow: 1, cursor: 'pointer', pt: (isBatchShareMode && canManage) ? 0 : 2 }}
                                  onClick={() => navigate(`/documents/${doc.id}?viewMode=${viewMode}`)}
                                >
                                <Box display="flex" alignItems="center" mb={1}>
                                  <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                  <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                                    {doc.title || '未命名文档'}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {doc.content ? stripHtmlTags(doc.content).substring(0, 150) : '空文档'}
                                  {doc.content && stripHtmlTags(doc.content).length > 150 ? '...' : ''}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  创建者: {doc.creator?.nickname || doc.creator?.username} | 
                                  更新于: {new Date(doc.updatedAt).toLocaleDateString()}
                                </Typography>
                              </CardContent>
                              <CardActions sx={{ justifyContent: 'flex-end', p: 1, gap: 0.5 }}>
                                {canManagePermissions(doc) && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => handleOpenPermissionDialog(e, doc)}
                                    title="权限管理"
                                  >
                                    <SettingsIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {canDeleteDocument(doc) && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => handleDeleteClick(e, doc)}
                                    title="删除文档"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </CardActions>
                            </Card>
                          </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                      ))}
                      {/* 显示没有文档的标签 */}
                      {userTagNames.filter(tag => !tagMap.has(tag)).length > 0 && (
                        <Box sx={{ mb: 4 }}>
                          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                            未使用的标签
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {userTagNames.filter(tag => !tagMap.has(tag)).map((tag) => {
                              const tagInfo = userTags.find(t => t.name === tag);
                              return (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  size="small"
                                  sx={{
                                    bgcolor: tagInfo?.color || 'grey.300',
                                    color: 'text.primary'
                                  }}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                  {noTag.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LabelIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="h5" component="h2">
                          无标签
                        </Typography>
                        <Chip label={`${noTag.length} 个文档`} size="small" sx={{ ml: 2 }} />
                      </Box>
                      <Grid container spacing={3}>
                        {noTag.map((doc) => {
                          const canManage = canManagePermissions(doc);
                          const isSelected = selectedDocuments.has(doc.id);
                          return (
                            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                              <Card
                                sx={{ 
                                  cursor: 'pointer', 
                                  height: '100%', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  '&:hover': { boxShadow: 4 },
                                  border: isSelected ? 2 : 0,
                                  borderColor: isSelected ? 'primary.main' : 'transparent'
                                }}
                              >
                                {isBatchShareMode && canManage && (
                                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelectDocument(doc.id);
                                      }}
                                      icon={<CheckBoxOutlineBlankIcon />}
                                      checkedIcon={<CheckBoxIcon />}
                                      size="small"
                                      sx={{ color: 'primary.main' }}
                                    />
                                  </Box>
                                )}
                                <CardContent 
                                  sx={{ flexGrow: 1, cursor: 'pointer', pt: (isBatchShareMode && canManage) ? 0 : 2 }}
                                  onClick={() => navigate(`/documents/${doc.id}?viewMode=${viewMode}`)}
                                >
                                <Box display="flex" alignItems="center" mb={1}>
                                  <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                  <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                                    {doc.title || '未命名文档'}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {doc.content ? stripHtmlTags(doc.content).substring(0, 150) : '空文档'}
                                  {doc.content && stripHtmlTags(doc.content).length > 150 ? '...' : ''}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  创建者: {doc.creator?.nickname || doc.creator?.username} | 
                                  更新于: {new Date(doc.updatedAt).toLocaleDateString()}
                                </Typography>
                              </CardContent>
                              <CardActions sx={{ justifyContent: 'flex-end', p: 1, gap: 0.5 }}>
                                {canManagePermissions(doc) && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => handleOpenPermissionDialog(e, doc)}
                                    title="权限管理"
                                  >
                                    <SettingsIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {canDeleteDocument(doc) && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => handleDeleteClick(e, doc)}
                                    title="删除文档"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </CardActions>
                            </Card>
                          </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </>
        )}
      </Container>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          确认删除文档
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            您确定要删除文档 "{documentToDelete?.title}" 吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            取消
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 模板选择对话框 */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>选择模板</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => handleCreateDocument()}
              sx={{ mb: 2 }}
            >
              创建空白文档
            </Button>
          </Box>
          {loadingTemplates ? (
            <Box textAlign="center" py={4}>
              <Typography>加载模板中...</Typography>
            </Box>
          ) : templates.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                暂无可用模板
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': { boxShadow: 4 }
                    }}
                    onClick={() => handleCreateDocument(template.id)}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <TemplateIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                          {template.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {template.description || '无描述'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        使用次数: {template.usageCount}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>取消</Button>
          <Button onClick={() => navigate('/templates')} color="primary">
            管理模板
          </Button>
        </DialogActions>
      </Dialog>

      {/* 权限管理对话框 */}
      <Dialog open={permissionDialogOpen} onClose={() => setPermissionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span">
              权限管理 - {selectedDocument?.title || '未命名文档'}
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setPermissionDialogOpen(false)}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              管理该文档的用户权限
            </Typography>
            {loadingPermissions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <List>
                {permissions.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="暂无共享用户" />
                  </ListItem>
                ) : (
                  permissions.map((perm) => (
                    <ListItem 
                      key={perm.id}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Select
                            size="small"
                            value={perm.permission}
                            onChange={(e) => handleUpdatePermission(perm.id, e.target.value)}
                            sx={{ minWidth: 120 }}
                          >
                            <MenuItem value="read">查看者（只读）</MenuItem>
                            <MenuItem value="write">编辑者（可编辑）</MenuItem>
                            <MenuItem value="admin">管理员（可管理权限）</MenuItem>
                          </Select>
                          <MuiIconButton
                            edge="end"
                            size="small"
                            color="error"
                            onClick={() => handleDeletePermission(perm.id)}
                            title="移除权限"
                          >
                            <DeleteIcon />
                          </MuiIconButton>
                        </Box>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={perm.user?.avatar ? (perm.user.avatar.startsWith('http') ? perm.user.avatar : `http://127.0.0.1:3001${perm.user.avatar}`) : undefined}
                        >
                          {perm.user?.nickname?.[0] || perm.user?.username?.[0] || 'U'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {perm.user?.nickname || perm.user?.username}
                            </Typography>
                            {perm.user?.id === selectedDocument?.creatorId && (
                              <Chip label="创建者" size="small" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={`权限: ${perm.permission === 'read' ? '查看者（只读）' : perm.permission === 'write' ? '编辑者（可编辑）' : '管理员（可管理权限）'}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 标签管理对话框 */}
      <Dialog 
        open={tagsDialogOpen} 
        onClose={() => setTagsDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span">
              管理我的标签
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setTagsDialogOpen(false)}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="输入标签名称"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleCreateTag}
                startIcon={<AddIcon />}
                sx={{ whiteSpace: 'nowrap', minWidth: '80px' }}
              >
                添加
              </Button>
            </Box>
            {loadingTags ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <List>
                {userTags.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="暂无标签" />
                  </ListItem>
                ) : (
                  userTags.map((tag) => (
                    <ListItem
                      key={tag.id}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {editingTag === tag.id ? (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const input = document.getElementById(`tag-input-${tag.id}`);
                                  if (input) {
                                    handleUpdateTag(tag.id, input.value);
                                  }
                                }}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setEditingTag(null)}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => setEditingTag(tag.id)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteTag(tag.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      }
                    >
                      {editingTag === tag.id ? (
                        <TextField
                          id={`tag-input-${tag.id}`}
                          size="small"
                          defaultValue={tag.name}
                          fullWidth
                          autoFocus
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateTag(tag.id, e.target.value);
                            } else if (e.key === 'Escape') {
                              setEditingTag(null);
                            }
                          }}
                        />
                      ) : (
                        <ListItemText primary={tag.name} />
                      )}
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagsDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 批量分享对话框 */}
      <Dialog
        open={batchShareDialogOpen}
        onClose={() => {
          setBatchShareDialogOpen(false);
          setShareUsers([]);
          // 不退出批量分享模式，用户可以继续选择其他文档
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span">
              批量分享文档
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => {
                setBatchShareDialogOpen(false);
                setShareUsers([]);
              }}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              已选择 {selectedDocuments.size} 个文档，选择要分享的用户
            </Typography>
            
            {/* 权限选择 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="share-permission-label">分享权限</InputLabel>
              <Select
                labelId="share-permission-label"
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value)}
                label="分享权限"
              >
                <MenuItem value="read">查看者（只读）</MenuItem>
                <MenuItem value="write">编辑者（可编辑）</MenuItem>
                <MenuItem value="admin">管理员（可管理权限）</MenuItem>
              </Select>
            </FormControl>

            {/* 用户搜索和选择 */}
            <Autocomplete
              multiple
              options={searchUserResults}
              value={shareUsers}
              onChange={(event, newValue) => {
                setShareUsers(newValue);
              }}
              onInputChange={(event, newInputValue) => {
                handleSearchUsers(newInputValue);
              }}
              getOptionLabel={(option) => option.nickname || option.username || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingUsers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="搜索并选择用户"
                  placeholder="输入用户名、昵称或邮箱"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <ListItem {...props} key={option.id}>
                  <ListItemAvatar>
                    <Avatar
                      src={option.avatar ? (option.avatar.startsWith('http') ? option.avatar : `http://127.0.0.1:3001${option.avatar}`) : undefined}
                    >
                      {option.nickname?.[0] || option.username?.[0] || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={option.nickname || option.username}
                    secondary={option.email}
                  />
                </ListItem>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.nickname || option.username}
                    avatar={
                      <Avatar
                        src={option.avatar ? (option.avatar.startsWith('http') ? option.avatar : `http://127.0.0.1:3001${option.avatar}`) : undefined}
                      >
                        {option.nickname?.[0] || option.username?.[0] || 'U'}
                      </Avatar>
                    }
                  />
                ))
              }
            />

            {/* 已选择的用户列表 */}
            {shareUsers.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  已选择 {shareUsers.length} 个用户
                </Typography>
                <List dense>
                  {shareUsers.map((user) => (
                    <ListItem key={user.id}>
                      <ListItemAvatar>
                        <Avatar
                          src={user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://127.0.0.1:3001${user.avatar}`) : undefined}
                        >
                          {user.nickname?.[0] || user.username?.[0] || 'U'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.nickname || user.username}
                        secondary={user.email}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBatchShareDialogOpen(false);
              setShareUsers([]);
            }}
          >
            取消
          </Button>
          <Button
            onClick={handleBatchShare}
            variant="contained"
            disabled={shareUsers.length === 0 || sharingDocuments}
            startIcon={sharingDocuments ? <CircularProgress size={20} /> : <ShareIcon />}
          >
            {sharingDocuments ? '分享中...' : '确认分享'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 文件夹管理对话框 */}
      <Dialog 
        open={foldersDialogOpen} 
        onClose={() => setFoldersDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span">
              管理我的文件夹
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setFoldersDialogOpen(false)}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="输入文件夹名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleCreateFolder}
                startIcon={<AddIcon />}
                sx={{ whiteSpace: 'nowrap', minWidth: '80px' }}
              >
                添加
              </Button>
            </Box>
            {loadingFolders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <List>
                {userFolders.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="暂无文件夹" />
                  </ListItem>
                ) : (
                  userFolders.map((folder) => (
                    <ListItem
                      key={folder.id}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {editingFolder === folder.id ? (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const input = document.getElementById(`folder-input-${folder.id}`);
                                  if (input) {
                                    handleUpdateFolder(folder.id, input.value);
                                  }
                                }}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setEditingFolder(null)}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => setEditingFolder(folder.id)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteFolder(folder.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      }
                    >
                      {editingFolder === folder.id ? (
                        <TextField
                          id={`folder-input-${folder.id}`}
                          size="small"
                          defaultValue={folder.name}
                          fullWidth
                          autoFocus
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateFolder(folder.id, e.target.value);
                            } else if (e.key === 'Escape') {
                              setEditingFolder(null);
                            }
                          }}
                        />
                      ) : (
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <FolderIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                              {folder.name}
                            </Box>
                          }
                        />
                      )}
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFoldersDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents;


