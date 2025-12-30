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
  AppBar,
  Toolbar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '100'); // 增加限制以获取更多用户
      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status_filter', statusFilter);
      }
      const response = await axios.get(`/api/users/list?${params.toString()}`);
      console.log('用户列表响应:', response.data); // 调试信息
      setUsers(response.data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      console.error('错误详情:', error.response?.data); // 调试信息
      alert('获取用户列表失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchUsers();
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            用户管理
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="搜索用户..."
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
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>角色</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="角色"
              >
                <MenuItem value="all">全部</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="normal">普通用户</MenuItem>
              </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>状态</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="状态"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="active">活跃</MenuItem>
              <MenuItem value="inactive">非活跃</MenuItem>
              <MenuItem value="banned">已禁用</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleSearch}>
            搜索
          </Button>
        </Box>

        {loading ? (
          <Typography>加载中...</Typography>
        ) : users.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary">
              暂无用户
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>用户</TableCell>
                  <TableCell>邮箱</TableCell>
                  <TableCell>角色</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>最后登录</TableCell>
                  <TableCell>注册时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{ width: 32, height: 32 }}
                          src={u.avatar ? (u.avatar.startsWith('http') ? u.avatar : `http://127.0.0.1:3001${u.avatar}`) : undefined}
                        >
                          {u.nickname?.[0] || u.username?.[0] || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{u.nickname || u.username}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{u.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role === 'admin' ? '管理员' : '普通用户'}
                        color={u.role === 'admin' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.status === 'active' ? '活跃' : u.status === 'inactive' ? '非活跃' : '已禁用'}
                        color={u.status === 'active' ? 'success' : u.status === 'inactive' ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '从未登录'}
                    </TableCell>
                    <TableCell>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
};

export default Users;

