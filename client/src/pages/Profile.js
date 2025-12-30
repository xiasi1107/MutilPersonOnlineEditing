import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  AppBar,
  Toolbar,
  IconButton,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Profile = () => {
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    phone: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      await axios.put(`/api/users/${user.id}`, formData);
      await fetchUser();
      setMessage('个人信息更新成功');
    } catch (error) {
      setError(error.response?.data?.detail || error.response?.data?.message || '更新失败');
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 检查文件大小（限制为 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `/api/users/${user.id}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // 上传成功后立即更新头像，不等待 fetchUser
      if (response.data?.avatar) {
        // 立即更新本地用户信息中的头像
        const updatedUser = { ...user, avatar: response.data.avatar };
        // 通过 fetchUser 刷新完整的用户信息
        await fetchUser();
      } else {
        await fetchUser();
      }
      setMessage('头像上传成功');
    } catch (error) {
      setError(error.response?.data?.detail || error.response?.data?.message || '头像上传失败');
    } finally {
      setUploading(false);
      // 清空文件输入，以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            个人资料
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                sx={{ 
                  width: 100, 
                  height: 100, 
                  mb: 2,
                  cursor: uploading ? 'wait' : 'pointer',
                  opacity: uploading ? 0.7 : 1
                }}
                src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://127.0.0.1:3001${user.avatar}`) : undefined}
                onClick={handleAvatarClick}
              >
                {user?.nickname?.[0] || user?.username?.[0] || 'U'}
              </Avatar>
              <IconButton
                color="primary"
                aria-label="上传头像"
                component="span"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'background.paper',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={handleAvatarClick}
                disabled={uploading}
              >
                <PhotoCameraIcon />
              </IconButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={uploading}
              />
            </Box>
            {uploading && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                上传中...
              </Typography>
            )}
            <Typography variant="h5">{user?.nickname || user?.username}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.role === 'admin' ? '管理员' : user?.role === 'editor' ? '编辑者' : '查看者'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              点击头像或相机图标上传新头像
            </Typography>
          </Box>

          {message && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              fullWidth
              label="昵称"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              fullWidth
              label="邮箱"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              fullWidth
              label="手机号"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              startIcon={<SaveIcon />}
              sx={{ mt: 3 }}
            >
              保存
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Profile;


