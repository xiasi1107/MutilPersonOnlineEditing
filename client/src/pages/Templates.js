import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Paper
} from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  DescriptionOutlined as TemplateIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Public as PublicIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Templates = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    content: '',
    category: '',
    description: '',
    isPublic: false
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('获取模板列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      await axios.post('/api/templates', formData);
      fetchTemplates();
      setCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      alert('创建模板失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      await axios.put(`/api/templates/${editingTemplate.id}`, formData);
      fetchTemplates();
      setEditDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    } catch (error) {
      alert('更新模板失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteClick = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    try {
      await axios.delete(`/api/templates/${templateToDelete.id}`);
      fetchTemplates();
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      alert('删除模板失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEditClick = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      title: template.title,
      content: template.content || '',
      category: template.category || '',
      description: template.description || '',
      isPublic: template.isPublic
    });
    setEditDialogOpen(true);
  };

  const handleUseTemplate = async (templateId) => {
    try {
      const response = await axios.post(`/api/templates/${templateId}/create-document`);
      navigate(`/documents/${response.data.document.id}`);
    } catch (error) {
      alert('创建文档失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      content: '',
      category: '',
      description: '',
      isPublic: false
    });
  };

  const canEditTemplate = (template) => {
    if (!user) return false;
    return template.creatorId === user.id || user.role === 'admin';
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/documents')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            模板管理
          </Typography>
          <Button
            color="inherit"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            新建模板
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {loading ? (
          <Typography>加载中...</Typography>
        ) : templates.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              暂无模板
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
              sx={{ mt: 2 }}
            >
              创建第一个模板
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {templates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <TemplateIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                        {template.name}
                      </Typography>
                      {template.isPublic ? (
                        <PublicIcon fontSize="small" color="primary" />
                      ) : (
                        <LockIcon fontSize="small" color="disabled" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {template.description || '无描述'}
                    </Typography>
                    {template.category && (
                      <Chip label={template.category} size="small" sx={{ mb: 1 }} />
                    )}
                    <Typography variant="caption" color="text.secondary" display="block">
                      使用次数: {template.usageCount} | 创建者: {template.creator?.nickname || template.creator?.username}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small" onClick={() => handleUseTemplate(template.id)}>
                      使用
                    </Button>
                    {canEditTemplate(template) && (
                      <>
                        <Button size="small" onClick={() => handleEditClick(template)}>
                          <EditIcon fontSize="small" sx={{ mr: 0.5 }} />
                          编辑
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(template)}
                        >
                          <DeleteIcon fontSize="small" sx={{ mr: 0.5 }} />
                          删除
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* 创建模板对话框 */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>创建模板</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            required
            fullWidth
            label="模板名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="文档标题（使用此模板时的默认标题）"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              模板内容
            </Typography>
            <Paper sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1 }}>
              <ReactQuill
                theme="snow"
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                style={{ height: '300px', marginBottom: '42px' }}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
              />
            </Paper>
          </Box>
          <TextField
            margin="normal"
            fullWidth
            label="分类"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={2}
            label="描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>可见性</InputLabel>
            <Select
              value={formData.isPublic ? 'public' : 'private'}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.value === 'public' })}
            >
              <MenuItem value="private">私有（仅自己可见）</MenuItem>
              <MenuItem value="public">公开（所有人可见）</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateTemplate} variant="contained">创建</Button>
        </DialogActions>
      </Dialog>

      {/* 编辑模板对话框 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>编辑模板</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            required
            fullWidth
            label="模板名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="文档标题（使用此模板时的默认标题）"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              模板内容
            </Typography>
            <Paper sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1 }}>
              <ReactQuill
                theme="snow"
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                style={{ height: '300px', marginBottom: '42px' }}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
              />
            </Paper>
          </Box>
          <TextField
            margin="normal"
            fullWidth
            label="分类"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={2}
            label="描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>可见性</InputLabel>
            <Select
              value={formData.isPublic ? 'public' : 'private'}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.value === 'public' })}
            >
              <MenuItem value="private">私有（仅自己可见）</MenuItem>
              <MenuItem value="public">公开（所有人可见）</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button onClick={handleUpdateTemplate} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除模板</DialogTitle>
        <DialogContent>
          <Typography>
            您确定要删除模板 "{templateToDelete?.name}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Templates;

