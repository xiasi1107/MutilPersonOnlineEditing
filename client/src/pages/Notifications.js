import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '100');
      if (typeFilter !== 'all') {
        params.append('type_filter', typeFilter);
      }
      if (readFilter !== 'all') {
        params.append('is_read', readFilter === 'read' ? 'true' : 'false');
      }
      const response = await axios.get(`/api/notifications?${params.toString()}`);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('获取通知列表失败:', error);
      alert('获取通知列表失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, readFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('标记已读失败:', error);
      alert('标记已读失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (notificationId) => {
    if (window.confirm('确定要删除这条通知吗？')) {
      try {
        await axios.delete(`/api/notifications/${notificationId}`);
        fetchNotifications();
      } catch (error) {
        console.error('删除通知失败:', error);
        alert('删除通知失败: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
      fetchNotifications();
    } catch (error) {
      console.error('标记全部已读失败:', error);
      alert('标记全部已读失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleNotificationClick = (notification) => {
    // 如果通知有关联的文档ID，跳转到文档编辑页面
    // 支持的类型：task（任务）、comment（评论）、mention（提及）、permission（权限）、edit（编辑）
    if (notification.relatedId) {
      navigate(`/documents/${notification.relatedId}`);
    }
    // 标记为已读
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
  };

  const getTypeLabel = (type) => {
    const typeMap = {
      'edit': '编辑',
      'comment': '评论',
      'task': '任务',
      'mention': '提及',
      'permission': '权限',
      'system': '系统',
      'video_conference': '视频会议'
    };
    return typeMap[type] || type;
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            通知中心
          </Typography>
          <Button color="inherit" onClick={handleMarkAllAsRead}>
            全部标记为已读
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>类型</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="类型"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="edit">编辑</MenuItem>
              <MenuItem value="comment">评论</MenuItem>
              <MenuItem value="task">任务</MenuItem>
              <MenuItem value="mention">提及</MenuItem>
              <MenuItem value="permission">权限</MenuItem>
              <MenuItem value="system">系统</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>状态</InputLabel>
            <Select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              label="状态"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="unread">未读</MenuItem>
              <MenuItem value="read">已读</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary">
              暂无通知
            </Typography>
          </Box>
        ) : (
          <Paper>
            <List>
              {notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {notification.title}
                        </Typography>
                        {!notification.isRead && (
                          <Chip label="未读" size="small" color="primary" />
                        )}
                        <Chip
                          label={getTypeLabel(notification.type)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.content}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {new Date(notification.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {!notification.isRead && (
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          title="标记为已读"
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        edge="end"
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification.id);
                        }}
                        title="删除"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default Notifications;

