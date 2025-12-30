import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Select,
  Chip,
  CircularProgress,
  IconButton as MuiIconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Description as DocumentIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as TemplateIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// 去除HTML标签，只保留纯文本
const stripHtmlTags = (html) => {
  if (!html) return '';
  // 创建一个临时div元素来解析HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // 获取纯文本内容
  return tmp.textContent || tmp.innerText || '';
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    fetchRecentDocuments();
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('获取未读通知失败:', error);
    }
  };

  const fetchRecentDocuments = async () => {
    try {
      const response = await axios.get('/api/documents?limit=6');
      setRecentDocuments(response.data.documents);
    } catch (error) {
      console.error('获取最近文档失败:', error);
    }
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
      
      // 检查响应结构
      const document = response.data.document || response.data;
      if (!document || !document.id) {
        console.error('创建文档失败: 响应格式不正确', response.data);
        alert('创建文档失败: 响应格式不正确');
        return;
      }
      
      navigate(`/documents/${document.id}`);
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

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
      fetchRecentDocuments();
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

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ flexGrow: 1 }}
            className="gongmo-brand"
          >
            共墨
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/notifications')}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <Avatar 
              sx={{ width: 32, height: 32 }}
              src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://127.0.0.1:3001${user.avatar}`) : undefined}
            >
              {user?.nickname?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
              <AccountIcon sx={{ mr: 1 }} /> 个人资料
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> 退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            sx={{ width: 64, height: 64 }}
            src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://127.0.0.1:3001${user.avatar}`) : undefined}
          >
            {user?.nickname?.[0] || user?.username?.[0] || 'U'}
          </Avatar>
          <Box>
            <Typography variant="h4" gutterBottom>
              欢迎, {user?.nickname || user?.username}!
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenTemplateDialog}
              sx={{ mt: 1 }}
            >
              创建新文档
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              最近文档
            </Typography>
            <Grid container spacing={2}>
                    {recentDocuments.map((doc) => (
                      <Grid item xs={12} sm={6} key={doc.id}>
                        <Card
                          sx={{ 
                            cursor: 'pointer', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            height: '100%',
                            '&:hover': { boxShadow: 4 } 
                          }}
                        >
                          <CardContent
                            sx={{ flexGrow: 1, cursor: 'pointer' }}
                            onClick={() => navigate(`/documents/${doc.id}`)}
                          >
                            <Box display="flex" alignItems="center" mb={1}>
                              <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                              <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                                {doc.title || '未命名文档'}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {doc.content ? stripHtmlTags(doc.content).substring(0, 100) : '空文档'}
                              {doc.content && stripHtmlTags(doc.content).length > 100 ? '...' : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              创建者: {doc.creator?.nickname || doc.creator?.username}
                            </Typography>
                          </CardContent>
                          <CardActions sx={{ justifyContent: 'flex-end', p: 1, minHeight: '48px', gap: 0.5 }}>
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
                            {canDeleteDocument(doc) ? (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => handleDeleteClick(e, doc)}
                                title="删除文档"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              !canManagePermissions(doc) && <Box sx={{ width: '40px' }} />
                            )}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
            </Grid>
            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => navigate('/documents')}
            >
              查看所有文档
            </Button>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  快速操作
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={handleOpenTemplateDialog}
                  >
                    新建文档
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DocumentIcon />}
                    onClick={() => navigate('/documents')}
                  >
                    文档列表
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<TemplateIcon />}
                    onClick={() => navigate('/templates')}
                  >
                    管理模板
                  </Button>
                  {user?.role === 'admin' && (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<PersonIcon />}
                      onClick={() => navigate('/users')}
                    >
                      用户管理
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
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
    </Box>
  );
};

export default Dashboard;


