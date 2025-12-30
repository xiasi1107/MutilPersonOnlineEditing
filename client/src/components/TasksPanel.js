import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const TasksPanel = ({ documentId, userPermission }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(null);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!documentId) return;
    try {
      setLoadingTasks(true);
      const response = await axios.get(`/api/tasks/?document_id=${documentId}`);
      setTasks(response.data || []);
    } catch (error) {
      console.error('获取任务列表失败:', error);
    } finally {
      setLoadingTasks(false);
    }
  }, [documentId]);

  const fetchAvailableUsers = useCallback(async () => {
    if (!documentId) return;
    try {
      setLoadingUsers(true);
      const userIds = new Set();
      const userMap = new Map();
      
      const [docResponse, permResponse] = await Promise.all([
        axios.get(`/api/documents/${documentId}`),
        axios.get(`/api/documents/${documentId}/permissions`)
      ]);
      
      if (docResponse.data.creator) {
        userIds.add(docResponse.data.creator.id);
        userMap.set(docResponse.data.creator.id, docResponse.data.creator);
      }
      
      permResponse.data.forEach(perm => {
        if (perm.user) {
          userIds.add(perm.user.id);
          userMap.set(perm.user.id, perm.user);
        }
      });
      
      setAvailableUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error('获取用户列表失败:', error);
      try {
        const searchRes = await axios.get('/api/users/search?q=&limit=100');
        setAvailableUsers(searchRes.data.filter(u => u.id !== user?.id));
      } catch (searchError) {
        console.error('搜索用户失败:', searchError);
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [documentId, user?.id]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskAssignee) {
      alert('请填写任务标题并选择分配者');
      return;
    }
    try {
      await axios.post('/api/tasks/', {
        documentId: documentId ? parseInt(documentId) : null,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        assigneeId: newTaskAssignee.id,
        dueDate: newTaskDueDate || null,
        priority: newTaskPriority
      });
      
      setCreateTaskDialogOpen(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskAssignee(null);
      setNewTaskDueDate('');
      setNewTaskPriority('medium');
      fetchTasks();
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('创建任务失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await axios.put(`/api/tasks/${taskId}`, {
        status: 'completed'
      });
      fetchTasks();
    } catch (error) {
      console.error('完成任务失败:', error);
      alert('完成任务失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('确定要删除这个任务吗？')) return;
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      fetchTasks();
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateTaskDialogOpen(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskAssignee(null);
    setNewTaskDueDate('');
    setNewTaskPriority('medium');
  };

  useEffect(() => {
    if (documentId) {
      fetchTasks();
      if (userPermission === 'admin') {
        fetchAvailableUsers();
      }
    }
  }, [documentId, userPermission, fetchTasks, fetchAvailableUsers]);

  return (
    <>
      <Box sx={{ 
        width: 350, 
        borderRight: 1, 
        borderColor: 'divider', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">任务</Typography>
          {userPermission === 'admin' && (
            <IconButton
              size="small"
              onClick={() => {
                setCreateTaskDialogOpen(true);
                fetchAvailableUsers();
              }}
              color="primary"
            >
              <AddIcon />
            </IconButton>
          )}
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {loadingTasks ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : tasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              暂无任务
            </Typography>
          ) : (
            <List>
              {tasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
                const isAssignee = task.assigneeId === user?.id;
                const isCreator = task.creatorId === user?.id;
                const canManage = userPermission === 'admin' || isCreator;
                
                return (
                  <Card
                    key={task.id}
                    sx={{
                      mb: 2,
                      bgcolor: isCompleted ? 'action.hover' : 'background.paper',
                      opacity: isCompleted ? 0.7 : 1
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            flexGrow: 1,
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            fontWeight: isCompleted ? 'normal' : 'medium'
                          }}
                        >
                          {task.title}
                        </Typography>
                        {canManage && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteTask(task.id)}
                            color="error"
                            sx={{ ml: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                      
                      {task.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {task.description}
                        </Typography>
                      )}
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={task.priority === 'high' ? '高优先级' : task.priority === 'low' ? '低优先级' : '中优先级'}
                          size="small"
                          color={task.priority === 'high' ? 'error' : task.priority === 'low' ? 'default' : 'warning'}
                        />
                        {task.dueDate && (
                          <Chip
                            icon={<ScheduleIcon />}
                            label={new Date(task.dueDate).toLocaleDateString()}
                            size="small"
                            color={isOverdue ? 'error' : 'default'}
                            variant={isOverdue ? 'filled' : 'outlined'}
                          />
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{ width: 24, height: 24 }}
                            src={task.assignee?.avatar ? (task.assignee.avatar.startsWith('http') ? task.assignee.avatar : `http://127.0.0.1:3001${task.assignee.avatar}`) : undefined}
                          >
                            {task.assignee?.nickname?.[0] || task.assignee?.username?.[0] || 'U'}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {task.assignee?.nickname || task.assignee?.username}
                          </Typography>
                        </Box>
                        {isAssignee && !isCompleted && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleCompleteTask(task.id)}
                            color="success"
                          >
                            完成
                          </Button>
                        )}
                        {isCompleted && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="已完成"
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </List>
          )}
        </Box>
      </Box>

      <Dialog
        open={createTaskDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">创建任务</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleCloseCreateDialog}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="任务标题"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="任务描述"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />

            <Autocomplete
              fullWidth
              options={availableUsers}
              value={newTaskAssignee}
              onChange={(event, newValue) => {
                setNewTaskAssignee(newValue);
              }}
              getOptionLabel={(option) => option.nickname || option.username || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingUsers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="分配给"
                  required
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
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="datetime-local"
              label="截止日期"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth>
              <InputLabel>优先级</InputLabel>
              <Select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                label="优先级"
              >
                <MenuItem value="low">低优先级</MenuItem>
                <MenuItem value="medium">中优先级</MenuItem>
                <MenuItem value="high">高优先级</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>
            取消
          </Button>
          <Button
            onClick={handleCreateTask}
            variant="contained"
            disabled={!newTaskTitle.trim() || !newTaskAssignee}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TasksPanel;

