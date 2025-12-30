import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Grid,
  Button,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Autocomplete,
  TextField,
  ListItemAvatar,
  ListItemText
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CallEnd as CallEndIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const VideoConference = ({ 
  documentId, 
  isOpen, 
  onClose, 
  socket,
  participants = [],
  availableMembers = []
}) => {
  const { user } = useAuth();
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [screenTrack, setScreenTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [participantList, setParticipantList] = useState(participants || []);
  
  const clientRef = useRef(null);
  const localVideoContainerRef = useRef(null);

  const [appId, setAppId] = useState(process.env.REACT_APP_AGORA_APP_ID || '04774e1fa58546d9a731066868f0eb83');
  const channelName = `doc_${documentId}`;
  const uid = user?.id || Math.floor(Math.random() * 100000);

  useEffect(() => {
    setParticipantList(participants || []);
  }, [participants]);

  useEffect(() => {
    if (isOpen && !clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
    }

    return () => {
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (screenTrack) {
        screenTrack.stop();
        screenTrack.close();
      }
      if (clientRef.current && isJoined) {
        clientRef.current.leave();
      }
    };
  }, []);

  useEffect(() => {
    if (localVideoTrack && isJoined) {
      let retryCount = 0;
      const maxRetries = 20;
      const tryPlayVideo = () => {
        if (localVideoContainerRef.current && localVideoTrack) {
          try {
            localVideoTrack.play('local-video-container', { mirror: true });
          } catch (error) {
            try {
              localVideoTrack.play(localVideoContainerRef.current, { mirror: true });
            } catch (elementError) {
            }
          }
        } else if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryPlayVideo, 100);
        }
      };
      tryPlayVideo();
    }
  }, [localVideoTrack, isJoined]);

  const handleUserPublished = async (user, mediaType) => {
    await clientRef.current.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
      setRemoteUsers(prev => {
        const updated = {
          ...prev,
          [user.uid]: {
            ...prev[user.uid],
            videoTrack: user.videoTrack,
            hasVideo: true,
            uid: user.uid
          }
        };
        setTimeout(() => {
          const containerId = `remote-video-${user.uid}`;
          const container = document.getElementById(containerId);
          if (container && user.videoTrack) {
            user.videoTrack.play(containerId, { mirror: true });
          }
        }, 100);
        return updated;
      });
    }
    if (mediaType === 'audio') {
      setRemoteUsers(prev => ({
        ...prev,
        [user.uid]: {
          ...prev[user.uid],
          audioTrack: user.audioTrack,
          hasAudio: true,
          uid: user.uid
        }
      }));
      user.audioTrack?.play();
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    if (mediaType === 'video') {
      setRemoteUsers(prev => ({
        ...prev,
        [user.uid]: {
          ...prev[user.uid],
          videoTrack: null,
          hasVideo: false
        }
      }));
    }
    if (mediaType === 'audio') {
      setRemoteUsers(prev => ({
        ...prev,
        [user.uid]: {
          ...prev[user.uid],
          audioTrack: null,
          hasAudio: false
        }
      }));
    }
  };

  const handleUserLeft = (user) => {
    setRemoteUsers(prev => {
      const newUsers = { ...prev };
      delete newUsers[user.uid];
      return newUsers;
    });
  };

  const fetchAgoraAppId = async () => {
    try {
      const response = await axios.get(`/api/agora/appid`);
      if (response.data.appId) {
        setAppId(response.data.appId);
      }
      return response.data.appId || appId;
    } catch (error) {
      return appId;
    }
  };

  const joinChannel = async () => {
    if (!user) {
      alert('用户未登录，请先登录');
      return;
    }

    try {
      setIsLoading(true);

      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ 
          mode: 'rtc', 
          codec: 'vp8' 
        });
      }

      clientRef.current.on('user-published', handleUserPublished);
      clientRef.current.on('user-unpublished', handleUserUnpublished);
      clientRef.current.on('user-left', handleUserLeft);

      const finalAppId = await fetchAgoraAppId();
      
      if (!finalAppId) {
        throw new Error('App ID 未配置，请检查后端配置或前端环境变量');
      }

      if (finalAppId.length !== 32) {
        throw new Error(`App ID 长度错误: 应为 32 字符，当前为 ${finalAppId.length} 字符`);
      }

      await clientRef.current.join(finalAppId, channelName, null, uid);
      setIsJoined(true);
      
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          });
        });
      });

      if (isVideoEnabled) {
        try {
          const videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '480p_1'
          });
          await clientRef.current.publish(videoTrack);
          setLocalVideoTrack(videoTrack);
          
          let retryCount = 0;
          const maxRetries = 10;
          const tryPlayVideo = () => {
            if (localVideoContainerRef.current && videoTrack) {
              try {
                videoTrack.play(localVideoContainerRef.current, { mirror: true });
              } catch (playError) {
              }
            } else if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(tryPlayVideo, 100);
            }
          };
          setTimeout(tryPlayVideo, 100);
        } catch (error) {
          let errorMessage = '无法访问摄像头: ' + error.message;
          if (error.message.includes('NotReadableError') || 
              error.message.includes('NotAllowedError') ||
              error.message.includes('NotFoundError')) {
            errorMessage += '\n\n可能的原因：\n';
            errorMessage += '1. 摄像头被设备上的物理开关阻止\n';
            errorMessage += '2. Windows 设置中摄像头被禁用\n';
            errorMessage += '3. 浏览器未授予摄像头权限\n';
            errorMessage += '4. 摄像头被其他应用占用';
          }
          alert(errorMessage);
          setIsVideoEnabled(false);
        }
      }

      if (isAudioEnabled) {
        try {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          await clientRef.current.publish(audioTrack);
        } catch (error) {
          alert('无法访问麦克风: ' + error.message + '\n\n请检查：\n1. 浏览器是否已授予麦克风权限\n2. 麦克风是否被其他应用占用');
          setIsAudioEnabled(false);
        }
      }

      if (clientRef.current.remoteUsers && clientRef.current.remoteUsers.length > 0) {
        for (const remoteUser of clientRef.current.remoteUsers) {
          try {
            if (remoteUser.hasVideo) {
              await handleUserPublished(remoteUser, 'video');
            }
            if (remoteUser.hasAudio) {
              await handleUserPublished(remoteUser, 'audio');
            }
          } catch (err) {
          }
        }
      }
      
      setTimeout(() => {
        if (socket) {
          socket.emit('video_conference_joined', {
            documentId,
            userId: user.id,
            channelName,
            uid
          });
        }
      }, 200);
    } catch (error) {
      let errorMessage = error.message || '未知错误';
      
      if (errorMessage.includes('CAN_NOT_GET_GATEWAY_SERVER') || 
          errorMessage.includes('invalid vendor key') ||
          errorMessage.includes('can not find appid')) {
        errorMessage = 'App ID 验证失败，请检查后端配置和 Agora 控制台';
      } else if (errorMessage.includes('INVALID_APP_ID')) {
        errorMessage = 'App ID 无效，请检查 .env 文件中的配置';
      }
      
      alert('加入视频会议失败: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const leaveChannel = async () => {
    try {
      setIsLoading(true);

      if (screenTrack) {
        await stopScreenShare();
      }

      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      if (clientRef.current && isJoined) {
        await clientRef.current.leave();
      }

      setIsJoined(false);
      setRemoteUsers({});

      if (socket) {
        socket.emit('video_conference_left', {
          documentId,
          userId: user?.id
        });
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVideo = async () => {
    if (!isJoined || !clientRef.current) {
      return;
    }

    if (isVideoEnabled) {
      try {
        if (localVideoTrack) {
          await localVideoTrack.setEnabled(false);
        }
        setIsVideoEnabled(false);
      } catch (error) {
        setIsVideoEnabled(false);
      }
    } else {
      try {
        if (localVideoTrack) {
          await localVideoTrack.setEnabled(true);
        } else {
          const videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '480p_1'
          });
          setLocalVideoTrack(videoTrack);
          
          if (localVideoContainerRef.current) {
            videoTrack.play(localVideoContainerRef.current, { mirror: true });
          } else {
            setTimeout(() => {
              if (localVideoContainerRef.current) {
                videoTrack.play(localVideoContainerRef.current, { mirror: true });
              }
            }, 100);
          }
          
          await clientRef.current.publish(videoTrack);
        }
        setIsVideoEnabled(true);
      } catch (error) {
        alert('无法访问摄像头: ' + error.message);
        setIsVideoEnabled(false);
      }
    }
  };

  const toggleAudio = async () => {
    if (!isJoined || !clientRef.current) {
      return;
    }

    if (isAudioEnabled) {
      try {
        if (localAudioTrack) {
          await localAudioTrack.setEnabled(false);
        }
        setIsAudioEnabled(false);
      } catch (error) {
        setIsAudioEnabled(false);
      }
    } else {
      try {
        if (localAudioTrack) {
          await localAudioTrack.setEnabled(true);
        } else {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          await clientRef.current.publish(audioTrack);
        }
        setIsAudioEnabled(true);
      } catch (error) {
        alert('无法访问麦克风: ' + error.message);
        setIsAudioEnabled(false);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      setIsLoading(true);
      
      if (localVideoTrack) {
        await clientRef.current.unpublish(localVideoTrack);
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }

      const screenVideoTrack = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1'
      });

      setScreenTrack(screenVideoTrack);
      
      if (localVideoContainerRef.current) {
        screenVideoTrack.play(localVideoContainerRef.current);
      }

      await clientRef.current.publish(screenVideoTrack);
      setIsSharingScreen(true);

      screenVideoTrack.on('track-ended', async () => {
        await stopScreenShare();
      });

    } catch (error) {
      alert('屏幕共享失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenTrack) {
        await clientRef.current.unpublish(screenTrack);
        screenTrack.stop();
        screenTrack.close();
        setScreenTrack(null);
        setIsSharingScreen(false);

        if (isVideoEnabled) {
          const videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '480p_1'
          });
          setLocalVideoTrack(videoTrack);
          if (localVideoContainerRef.current) {
            videoTrack.play(localVideoContainerRef.current, { mirror: true });
          }
          await clientRef.current.publish(videoTrack);
        }
      }
    } catch (error) {
    }
  };

  const handleClose = async () => {
    if (isJoined) {
      await leaveChannel();
    }
    onClose();
  };

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleUserJoined = (data) => {
      if (Array.isArray(data.participants)) {
        setParticipantList(() => {
          const map = new Map();
          data.participants.forEach(p => map.set(p.id, p));
          return Array.from(map.values());
        });
      } else if (data.user) {
        setParticipantList(prev => {
          const map = new Map(prev.map(p => [p.id, p]));
          map.set(data.user.id, data.user);
          return Array.from(map.values());
        });
      }
    };

    const handleUserLeft = (data) => {
      if (Array.isArray(data.participants)) {
        setParticipantList(() => {
          const map = new Map();
          data.participants.forEach(p => map.set(p.id, p));
          return Array.from(map.values());
        });
      } else if (data.userId) {
        setParticipantList(prev => prev.filter(p => p.id !== data.userId));
      }
    };

    socket.on('video_conference_user_joined', handleUserJoined);
    socket.on('video_conference_user_left', handleUserLeft);

    return () => {
      socket.off('video_conference_user_joined', handleUserJoined);
      socket.off('video_conference_user_left', handleUserLeft);
    };
  }, [socket, isOpen]);

  useEffect(() => {
    Object.entries(remoteUsers).forEach(([uid, userData]) => {
      if (userData.videoTrack) {
        const containerId = `remote-video-${uid}`;
        setTimeout(() => {
          const container = document.getElementById(containerId);
          if (container && userData.videoTrack) {
            userData.videoTrack.play(containerId, { mirror: true });
          }
        }, 100);
      }
    });
  }, [remoteUsers]);

  const remoteUsersArray = Object.values(remoteUsers);
  const totalParticipants = remoteUsersArray.length + (isJoined ? 1 : 0);
  
  const getVideoGridSize = () => {
    if (totalParticipants === 1) {
      return { xs: 12, sm: 12, md: 12 };
    } else if (totalParticipants === 2) {
      return { xs: 12, sm: 6, md: 6 };
    } else if (totalParticipants <= 4) {
      return { xs: 12, sm: 6, md: 6 };
    } else if (totalParticipants <= 6) {
      return { xs: 12, sm: 6, md: 4 };
    } else if (totalParticipants <= 9) {
      return { xs: 12, sm: 6, md: 4 };
    } else {
      return { xs: 12, sm: 6, md: 3 };
    }
  };
  
  const videoGridSize = getVideoGridSize();

  return (
    <>
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VideocamIcon />
          <Typography variant="h6">视频会议</Typography>
          {isJoined && (
            <Chip 
              label={`${totalParticipants} 人在线`} 
              size="small" 
              color="primary" 
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isJoined && availableMembers.length > 0 && (
            <Tooltip title="邀请成员">
              <IconButton onClick={() => setInviteDialogOpen(true)} size="small" color="primary">
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!isJoined ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            py: 4
          }}>
            <VideocamIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              加入视频会议
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              与文档协作者进行实时视频通话
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={joinChannel}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <VideocamIcon />}
            >
              {isLoading ? '加入中...' : '加入会议'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ 
              flexGrow: 1, 
              overflow: 'auto',
              p: 1,
              bgcolor: 'grey.900'
            }}>
              <Grid container spacing={1} sx={{ height: '100%' }}>
                <Grid item xs={videoGridSize.xs} sm={videoGridSize.sm} md={videoGridSize.md}>
                  <Paper sx={{ 
                    position: 'relative',
                    paddingTop: '56.25%',
                    bgcolor: 'black',
                    overflow: 'hidden'
                  }}>
                    <Box
                      ref={localVideoContainerRef}
                      id="local-video-container"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2,
                        backgroundColor: 'transparent',
                        '& video': {
                          width: '100% !important',
                          height: '100% !important',
                          minWidth: '100% !important',
                          minHeight: '100% !important',
                          objectFit: 'cover',
                          display: 'block !important',
                          position: 'absolute !important',
                          top: '0 !important',
                          left: '0 !important',
                          zIndex: '15 !important',
                          backgroundColor: 'transparent !important',
                          pointerEvents: 'auto'
                        }
                      }}
                    />
                    {!isVideoEnabled && !isSharingScreen && (
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.800',
                        zIndex: 1
                      }}>
                        <Avatar sx={{ width: 64, height: 64, mb: 1 }}>
                          {user?.nickname?.[0] || user?.username?.[0] || 'U'}
                        </Avatar>
                        <Typography variant="body2" color="white">
                          {user?.nickname || user?.username || '我'}
                        </Typography>
                      </Box>
                    )}
                    <Chip
                      label={isSharingScreen ? '屏幕共享中' : (user?.nickname || user?.username || '我')}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: 'white'
                      }}
                    />
                    {!isAudioEnabled && (
                      <Chip
                        icon={<MicOffIcon />}
                        label="静音"
                        size="small"
                        color="error"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8
                        }}
                      />
                    )}
                  </Paper>
                </Grid>

                {remoteUsersArray.map((userData, index) => (
                  <Grid item xs={videoGridSize.xs} sm={videoGridSize.sm} md={videoGridSize.md} key={userData.uid || index}>
                    <Paper sx={{ 
                      position: 'relative',
                      paddingTop: '56.25%',
                      bgcolor: 'black',
                      overflow: 'hidden'
                    }}>
                      <Box
                        id={`remote-video-${userData.uid}`}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%'
                        }}
                      />
                      {!userData.hasVideo && (
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.800'
                        }}>
                          <Avatar sx={{ width: 64, height: 64, mb: 1 }}>
                            <PersonIcon />
                          </Avatar>
                          <Typography variant="body2" color="white">
                            用户 {userData.uid}
                          </Typography>
                        </Box>
                      )}
                      <Chip
                        label={`用户 ${userData.uid}`}
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: 'white'
                        }}
                      />
                      {!userData.hasAudio && (
                        <Chip
                          icon={<MicOffIcon />}
                          label="静音"
                          size="small"
                          color="error"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8
                          }}
                        />
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 2, 
              p: 2,
              borderTop: 1,
              borderColor: 'divider'
            }}>
              <Tooltip title={isVideoEnabled ? "关闭视频" : "开启视频"}>
                <IconButton
                  color={isVideoEnabled ? "primary" : "default"}
                  onClick={toggleVideo}
                  disabled={isLoading || isSharingScreen}
                  sx={{ 
                    bgcolor: isVideoEnabled ? 'primary.main' : 'grey.300',
                    color: isVideoEnabled ? 'white' : 'black',
                    '&:hover': {
                      bgcolor: isVideoEnabled ? 'primary.dark' : 'grey.400'
                    }
                  }}
                >
                  {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title={isAudioEnabled ? "静音" : "取消静音"}>
                <IconButton
                  color={isAudioEnabled ? "primary" : "default"}
                  onClick={toggleAudio}
                  disabled={isLoading}
                  sx={{ 
                    bgcolor: isAudioEnabled ? 'primary.main' : 'grey.300',
                    color: isAudioEnabled ? 'white' : 'black',
                    '&:hover': {
                      bgcolor: isAudioEnabled ? 'primary.dark' : 'grey.400'
                    }
                  }}
                >
                  {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title={isSharingScreen ? "停止共享" : "共享屏幕"}>
                <IconButton
                  color={isSharingScreen ? "error" : "primary"}
                  onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                  disabled={isLoading}
                  sx={{ 
                    bgcolor: isSharingScreen ? 'error.main' : 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: isSharingScreen ? 'error.dark' : 'primary.dark'
                    }
                  }}
                >
                  {isSharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title="离开会议">
                <IconButton
                  color="error"
                  onClick={handleClose}
                  disabled={isLoading}
                  sx={{ 
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'error.dark'
                    }
                  }}
                >
                  <CallEndIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>

    <Dialog 
      open={inviteDialogOpen} 
      onClose={() => {
        setInviteDialogOpen(false);
        setSelectedMembers([]);
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>邀请成员加入视频会议</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            multiple
            options={availableMembers.filter(m => m.id !== user?.id)}
            value={selectedMembers}
            onChange={(event, newValue) => {
              setSelectedMembers(newValue);
            }}
            getOptionLabel={(option) => option.nickname || option.username || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="选择要邀请的成员"
                placeholder="搜索并选择成员"
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <ListItemAvatar>
                  <Avatar>
                    {option.nickname?.[0] || option.username?.[0] || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={option.nickname || option.username}
                  secondary={option.email}
                />
              </Box>
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          setInviteDialogOpen(false);
          setSelectedMembers([]);
        }}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            if (selectedMembers.length === 0) {
              alert('请至少选择一个成员');
              return;
            }
            try {
              setInviting(true);
              const response = await axios.post(`/api/documents/${documentId}/video-invite`, {
                userIds: selectedMembers.map(m => m.id)
              });
              alert(response.data.message || '邀请已发送');
              setInviteDialogOpen(false);
              setSelectedMembers([]);
            } catch (error) {
              alert('发送邀请失败: ' + (error.response?.data?.detail || error.message));
            } finally {
              setInviting(false);
            }
          }}
          disabled={inviting || selectedMembers.length === 0}
          startIcon={inviting ? <CircularProgress size={20} /> : <PersonAddIcon />}
        >
          {inviting ? '发送中...' : '发送邀请'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default VideoConference;

