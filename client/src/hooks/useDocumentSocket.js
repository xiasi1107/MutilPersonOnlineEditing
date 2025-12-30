import { useRef, useCallback, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

/**
 * 文档实时协作 Socket Hook
 * 处理 WebSocket 连接、用户加入/离开、文档同步等
 */
export const useDocumentSocket = (documentId, onDocumentUpdate, onTitleUpdate, onCursorUpdate, onUserJoined, onUserLeft) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const connectSocket = useCallback(() => {
    // 如果是新文档，不连接 socket
    if (documentId === 'new' || !documentId) {
      return;
    }
    
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://127.0.0.1:3001';
    const token = localStorage.getItem('token');
    socketRef.current = io(socketUrl, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket 连接成功');
      // 连接成功后加入文档
      socketRef.current.emit('user_join', {
        documentId: documentId
      });
    });

    socketRef.current.on('user_joined', (data) => {
      onUserJoined?.(data);
    });

    socketRef.current.on('user_left', (data) => {
      onUserLeft?.(data);
    });

    socketRef.current.on('document_updated', (data) => {
      onDocumentUpdate?.(data);
    });

    socketRef.current.on('cursor_updated', (data) => {
      onCursorUpdate?.(data);
    });

    socketRef.current.on('title_updated', (data) => {
      onTitleUpdate?.(data);
    });

    socketRef.current.on('document_locked', ({ isLocked: newLockedStatus }) => {
      // 可以通过回调通知父组件
    });

    socketRef.current.on('error', ({ message }) => {
      console.error('Socket错误:', message);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('user_leave', { documentId: documentId });
        socketRef.current.disconnect();
      }
    };
  }, [documentId, onDocumentUpdate, onTitleUpdate, onCursorUpdate, onUserJoined, onUserLeft]);

  // 发送文档编辑事件
  const emitDocumentEdit = useCallback((content) => {
    if (socketRef.current?.connected && documentId !== 'new') {
      socketRef.current.emit('document_edit', {
        documentId: documentId,
        content: content,
        userId: user.id
      });
    }
  }, [documentId, user.id]);

  // 发送标题更新事件
  const emitTitleUpdate = useCallback((title) => {
    if (socketRef.current?.connected && documentId !== 'new') {
      socketRef.current.emit('title_update', {
        documentId: documentId,
        title: title,
        userId: user.id
      });
    }
  }, [documentId, user.id]);

  // 发送光标更新事件
  const emitCursorUpdate = useCallback((position, selection) => {
    if (socketRef.current?.connected && documentId !== 'new') {
      socketRef.current.emit('cursor_update', {
        documentId: documentId,
        position: position,
        selection: selection
      });
    }
  }, [documentId]);

  useEffect(() => {
    const cleanup = connectSocket();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connectSocket]);

  return {
    socket: socketRef.current,
    emitDocumentEdit,
    emitTitleUpdate,
    emitCursorUpdate
  };
};

