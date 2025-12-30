import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetToken('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      setSuccess(response.data.message);
      
      // 开发环境：显示重置令牌和链接
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
      }
    } catch (error) {
      setError(error.response?.data?.detail || error.response?.data?.message || '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            忘记密码
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            请输入您的邮箱地址，我们将发送重置密码的链接
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          
          {resetToken && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>开发环境提示：</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                重置令牌：{resetToken}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => navigate(`/reset-password?token=${resetToken}`)}
              >
                点击前往重置密码页面
              </Button>
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="邮箱地址"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? '发送中...' : '发送重置链接'}
            </Button>
            <Box textAlign="center">
              <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography variant="body2" color="primary">
                  返回登录
                </Typography>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;

