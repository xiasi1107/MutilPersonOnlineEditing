import { useRef, useCallback, useEffect } from 'react';

/**
 * 光标指示器 Hook
 * 管理其他用户的光标位置显示，包括创建、更新和清理光标指示器
 */
export const useCursorIndicators = (quillRef, editors, currentUserId, otherUsersCursors, setOtherUsersCursors) => {
  const cursorIndicatorsRef = useRef({});

  const getUserColor = useCallback((userId) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[parseInt(userId) % colors.length];
  }, []);

  const updateCursorIndicator = useCallback((userId, position, selection) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let editor = editors.find(e => e.id === parseInt(userId));
    if (!editor && parseInt(userId) === currentUserId) {
      editor = {
        id: currentUserId,
        username: 'You',
        nickname: 'You'
      };
    }
    if (!editor) {
      console.warn(`找不到用户 ${userId} 的编辑器信息`);
      return;
    }

    try {
      const bounds = quill.getBounds(position || 0);
      if (!bounds) {
        if (cursorIndicatorsRef.current[userId]) {
          const { indicator, label } = cursorIndicatorsRef.current[userId];
          if (indicator) indicator.style.display = 'none';
          if (label) label.style.display = 'none';
        }
        return;
      }

      const quillEditor = quill.container.querySelector('.ql-editor');
      if (!quillEditor) return;

      const editorContainer = quill.container.parentElement;
      if (!editorContainer) return;

      // 确保容器是相对定位，以便光标指示器可以绝对定位
      if (getComputedStyle(editorContainer).position === 'static') {
        editorContainer.style.position = 'relative';
      }

      const editorRect = quillEditor.getBoundingClientRect();
      const containerRect = editorContainer.getBoundingClientRect();

      const left = bounds.left + (editorRect.left - containerRect.left);
      const top = bounds.top + (editorRect.top - containerRect.top);

      let indicator, label;
      if (cursorIndicatorsRef.current[userId]) {
        indicator = cursorIndicatorsRef.current[userId].indicator;
        label = cursorIndicatorsRef.current[userId].label;
        
        indicator.style.left = `${left}px`;
        indicator.style.top = `${top}px`;
        indicator.style.height = `${bounds.height || 20}px`;
        indicator.style.display = 'block';
        
        label.style.left = `${left + 4}px`;
        label.style.top = `${top - 20}px`;
        label.style.display = 'block';
      } else {
        indicator = window.document.createElement('div');
        indicator.className = 'quill-cursor-indicator';
        indicator.style.cssText = `
          position: absolute;
          left: ${left}px;
          top: ${top}px;
          width: 2px;
          height: ${bounds.height || 20}px;
          background-color: ${getUserColor(userId)};
          z-index: 1000;
          pointer-events: none;
          animation: blink 1s infinite;
        `;

        label = window.document.createElement('div');
        label.className = 'quill-cursor-label';
        label.textContent = editor.nickname || editor.username;
        label.style.cssText = `
          position: absolute;
          left: ${left + 4}px;
          top: ${top - 20}px;
          background-color: ${getUserColor(userId)};
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          white-space: nowrap;
          z-index: 1001;
          pointer-events: none;
        `;

        editorContainer.appendChild(indicator);
        editorContainer.appendChild(label);
        cursorIndicatorsRef.current[userId] = { indicator, label };
      }
    } catch (error) {
      console.error('更新光标指示器失败:', error);
    }
  }, [quillRef, editors, currentUserId, getUserColor]);

  /**
   * 定期更新光标指示器位置并清理过期光标
   * 使用 requestAnimationFrame 限制更新频率至约 60fps
   * 自动移除超过 3 秒未更新的光标指示器
   */
  useEffect(() => {
    let animationFrameId;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 16; // 约 60fps (1000ms / 60 ≈ 16ms)

    const updateCursors = (currentTime) => {
      if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
        animationFrameId = requestAnimationFrame(updateCursors);
        return;
      }
      lastUpdateTime = currentTime;

      const now = Date.now();
      const quill = quillRef.current?.getEditor();
      if (!quill) {
        animationFrameId = requestAnimationFrame(updateCursors);
        return;
      }

      Object.entries(otherUsersCursors).forEach(([userId, cursorInfo]) => {
        if (now - cursorInfo.timestamp > 3000) {
          if (cursorIndicatorsRef.current[userId]) {
            const { indicator, label } = cursorIndicatorsRef.current[userId];
            if (indicator && indicator.parentElement) {
              indicator.remove();
            }
            if (label && label.parentElement) {
              label.remove();
            }
            delete cursorIndicatorsRef.current[userId];
          }
          setOtherUsersCursors(prev => {
            const newCursors = { ...prev };
            delete newCursors[userId];
            return newCursors;
          });
        } else {
          updateCursorIndicator(userId, cursorInfo.position, cursorInfo.selection);
        }
      });

      animationFrameId = requestAnimationFrame(updateCursors);
    };

    animationFrameId = requestAnimationFrame(updateCursors);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [otherUsersCursors, updateCursorIndicator, quillRef, setOtherUsersCursors]);

  const cleanup = useCallback(() => {
    Object.values(cursorIndicatorsRef.current).forEach(({ indicator, label }) => {
      if (indicator && indicator.parentElement) {
        indicator.remove();
      }
      if (label && label.parentElement) {
        label.remove();
      }
    });
    cursorIndicatorsRef.current = {};
  }, []);

  return {
    updateCursorIndicator,
    cleanup
  };
};

