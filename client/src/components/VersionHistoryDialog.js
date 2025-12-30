import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider
} from '@mui/material';
import {
  History as HistoryIcon,
  Compare as CompareIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import axios from 'axios';

const VersionContentWithHighlights = ({ content, title, highlights, highlightType = 'all' }) => {
  const stripHtml = (html) => {
    if (!html) return '';
    let text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
    text = text.replace(/<[^>]+>/g, '');
    return text.trim();
  };

  const applyHighlightsToHtml = (html, highlights, highlightType = 'all') => {
    if (!html) {
      return '<p>（无内容）</p>';
    }

    if (!highlights || highlights.length === 0) {
      return html;
    }

    const filteredHighlights = highlightType === 'all' 
      ? highlights 
      : highlights.filter(h => h.type === highlightType);

    if (filteredHighlights.length === 0) {
      return html;
    }

    const plainText = stripHtml(html);
    
    const buildTextToHtmlMap = (htmlStr) => {
      const map = [];
      let textPos = 0;
      let inTag = false;
      let inEntity = false;
      let entityBuffer = '';
      
      for (let i = 0; i < htmlStr.length; i++) {
        const char = htmlStr[i];
        if (char === '<') {
          inTag = true;
        } else if (char === '>') {
          inTag = false;
        } else if (char === '&' && !inTag) {
          inEntity = true;
          entityBuffer = '&';
        } else if (inEntity) {
          entityBuffer += char;
          if (char === ';') {
            inEntity = false;
            map[textPos] = i - entityBuffer.length + 1;
            textPos++;
          }
        } else if (!inTag && !inEntity) {
          map[textPos] = i;
          textPos++;
        }
      }
      map[textPos] = htmlStr.length;
      return map;
    };
    
    const textToHtmlMap = buildTextToHtmlMap(html);
    
    const highlightPositions = [];
    
    for (const highlight of filteredHighlights) {
      const start = highlight.start !== undefined ? highlight.start : highlight.position || 0;
      const end = highlight.end !== undefined ? highlight.end : start + (highlight.content?.length || 0);
      const highlightText = highlight.content || '';
      
      if (start >= 0 && end > start && end <= plainText.length && highlightText) {
        const foundStart = textToHtmlMap[start];
        const foundEnd = textToHtmlMap[end];
        
        if (foundStart !== undefined && foundEnd !== undefined && foundEnd > foundStart) {
          const htmlSubstring = html.substring(foundStart, foundEnd);
          const htmlText = stripHtml(htmlSubstring);
          
          if (htmlText === highlightText || htmlText.includes(highlightText) || highlightText.includes(htmlText)) {
            highlightPositions.push({
              start: foundStart,
              end: foundEnd,
              type: highlight.type
            });
          }
        }
      }
    }
    
    highlightPositions.sort((a, b) => b.start - a.start);
    
    let result = html || '';
    for (const pos of highlightPositions) {
      const htmlText = result.substring(pos.start, pos.end);
      
      if (htmlText.trim().length > 0) {
        if (pos.type === 'added') {
          const before = result.substring(0, pos.start);
          const highlighted = `<mark style="background-color: #c8e6c9; padding: 2px 4px; border: 1px solid #4caf50; border-radius: 2px; display: inline;">${htmlText}</mark>`;
          const after = result.substring(pos.end);
          result = before + highlighted + after;
        } else if (pos.type === 'removed') {
          const before = result.substring(0, pos.start);
          const highlighted = `<mark style="background-color: #ffcdd2; padding: 2px 4px; border: 1px solid #f44336; border-radius: 2px; display: inline;">${htmlText}</mark>`;
          const after = result.substring(pos.end);
          result = before + highlighted + after;
        }
      }
    }
    
    return result || '<p>（无内容）</p>';
  };

  const highlightedHtml = (highlights && highlights.length > 0) 
    ? applyHighlightsToHtml(content || '', highlights, highlightType)
    : (content || '<p>（无内容）</p>');

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'grey.50',
        minHeight: '100%',
        border: '1px solid',
        borderColor: 'divider',
        height: '100%'
      }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      <Box
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        sx={{
          '& p': { margin: '0.5em 0' },
          '& h1, & h2, & h3': { margin: '0.8em 0 0.4em 0' },
          '& ul, & ol': { margin: '0.5em 0', paddingLeft: '1.5em' },
          '& mark': {
            display: 'inline',
            borderRadius: '2px',
            padding: '2px 4px'
          }
        }}
      />
    </Paper>
  );
};

const VersionHistoryDialog = ({ 
  open, 
  onClose, 
  documentId, 
  userPermission, 
  isDocumentLocked,
  onVersionRestored 
}) => {
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const fetchVersions = async () => {
    if (!documentId) return;
    try {
      setLoadingVersions(true);
      const response = await axios.get(`/api/documents/${documentId}/versions`);
      const versionsList = Array.isArray(response.data) ? response.data : [];
      setVersions(versionsList);
    } catch (error) {
      console.error('获取版本历史失败:', error);
      alert('获取版本历史失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!documentId) return;
    if (userPermission === 'read') {
      alert('您只有只读权限，无法恢复版本');
      return;
    }
    if (!window.confirm('确定要恢复到该版本吗？当前版本将被保存为新版本。')) {
      return;
    }
    
    try {
      setRestoringVersion(versionId);
      const response = await axios.post(`/api/documents/${documentId}/restore/${versionId}`);
      if (onVersionRestored) {
        onVersionRestored({
          title: response.data.title,
          content: response.data.content || ''
        });
      }
      await fetchVersions();
      onClose();
      alert('恢复成功！');
    } catch (error) {
      console.error('恢复版本失败:', error);
      const errorMsg = error.response?.data?.detail || error.message;
      alert('恢复失败: ' + errorMsg);
      if (errorMsg.includes('锁定')) {
        await fetchVersions();
      }
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleCompareVersions = async () => {
    if (!selectedHistoryVersion) {
      alert('请选择一个历史版本进行对比');
      return;
    }
    
    if (!documentId) return;
    
    const currentVersion = versions.length > 0 ? versions[0] : null;
    if (!currentVersion) {
      alert('无法获取当前版本');
      return;
    }
    
    if (currentVersion.id === selectedHistoryVersion) {
      alert('请选择不同的历史版本进行对比');
      return;
    }
    
    try {
      setLoadingCompare(true);
      const response = await axios.post(`/api/documents/${documentId}/versions/compare`, {
        versionId1: currentVersion.id,
        versionId2: selectedHistoryVersion
      });
      setCompareResult(response.data);
      setCompareDialogOpen(true);
    } catch (error) {
      console.error('版本对比失败:', error);
      alert('版本对比失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingCompare(false);
    }
  };

  useEffect(() => {
    if (open && documentId) {
      fetchVersions();
    }
  }, [open, documentId]);

  const handleClose = () => {
    setSelectedHistoryVersion(null);
    setExpandedVersion(null);
    setPreviewVersion(null);
    onClose();
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon />
              <Typography variant="h6">版本历史</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {versions.length >= 2 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CompareIcon />}
                  onClick={handleCompareVersions}
                  disabled={!selectedHistoryVersion || loadingCompare}
                >
                  {loadingCompare ? '对比中...' : '对比版本'}
                </Button>
              )}
              <IconButton
                aria-label="关闭"
                onClick={handleClose}
                sx={{ ml: 1 }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingVersions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              暂无版本历史
            </Typography>
          ) : (
            <Box>
              {versions.length >= 2 && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>选择历史版本与当前版本对比：</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      当前版本：版本 {versions[0]?.versionNumber}（最新）
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>选择历史版本</InputLabel>
                      <Select
                        value={selectedHistoryVersion || ''}
                        onChange={(e) => setSelectedHistoryVersion(e.target.value)}
                        label="选择历史版本"
                      >
                        {versions.slice(1).map((v) => (
                          <MenuItem key={v.id} value={v.id}>
                            版本 {v.versionNumber}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              )}
              {versions.map((version, index) => (
                <Card
                  key={version.id}
                  sx={{
                    mb: 2,
                    borderLeft: index === 0 ? '4px solid' : 'none',
                    borderColor: index === 0 ? 'primary.main' : 'transparent',
                    bgcolor: index === 0 ? 'action.selected' : 'background.paper',
                    opacity: version.isLocked ? 0.9 : 1
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="h6" fontWeight="medium">
                            版本 {version.versionNumber}
                          </Typography>
                          {index === 0 && (
                            <Chip label="当前版本" size="small" color="primary" />
                          )}
                          {version.isLocked && (
                            <Chip 
                              icon={<LockIcon />} 
                              label="已锁定" 
                              size="small" 
                              color="warning" 
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {version.creator?.nickname || version.creator?.username || '未知用户'} · {' '}
                          {new Date(version.createdAt).toLocaleString('zh-CN')}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 1, fontWeight: 'medium' }}>
                          {version.title}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {index > 0 && (
                          <>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<VisibilityIcon />}
                              onClick={() => {
                                if (expandedVersion === version.id) {
                                  setExpandedVersion(null);
                                  setPreviewVersion(null);
                                } else {
                                  setExpandedVersion(version.id);
                                  setPreviewVersion(version);
                                }
                              }}
                            >
                              {expandedVersion === version.id ? '隐藏预览' : '查看内容'}
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              color="primary"
                              startIcon={<RestoreIcon />}
                              onClick={() => handleRestoreVersion(version.id)}
                              disabled={restoringVersion === version.id || version.isLocked || isDocumentLocked || userPermission === 'read'}
                              title={
                                userPermission === 'read' 
                                  ? '您只有只读权限，无法恢复版本' 
                                  : isDocumentLocked 
                                    ? '文档已锁定，无法恢复版本' 
                                    : version.isLocked 
                                      ? '该版本已锁定，无法恢复' 
                                      : '恢复到此版本'
                              }
                            >
                              {restoringVersion === version.id ? '恢复中...' : '恢复到此版本'}
                            </Button>
                          </>
                        )}
                      </Box>
                    </Box>
                    
                    {expandedVersion === version.id && previewVersion && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                          版本内容预览：
                        </Typography>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: 'grey.50',
                            maxHeight: '400px',
                            overflow: 'auto',
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        >
                          <Box
                            dangerouslySetInnerHTML={{ __html: previewVersion.content || '<p>（无内容）</p>' }}
                            sx={{
                              '& p': { margin: '0.5em 0' },
                              '& h1, & h2, & h3': { margin: '0.8em 0 0.4em 0' },
                              '& ul, & ol': { margin: '0.5em 0', paddingLeft: '1.5em' }
                            }}
                          />
                        </Paper>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareIcon />
              <Typography variant="h6">版本对比</Typography>
            </Box>
            <IconButton
              aria-label="关闭"
              onClick={() => setCompareDialogOpen(false)}
              sx={{ ml: 2 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {compareResult && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    当前版本（版本 {compareResult.version1.versionNumber}）
                  </Typography>
                  <Typography variant="h6">{compareResult.version1.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {new Date(compareResult.version1.createdAt).toLocaleString('zh-CN')}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    对比版本（版本 {compareResult.version2.versionNumber}）
                  </Typography>
                  <Typography variant="h6">{compareResult.version2.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {new Date(compareResult.version2.createdAt).toLocaleString('zh-CN')}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', height: '600px' }}>
                <Box sx={{ flex: 1, borderRight: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      当前版本内容
                    </Typography>
                    <VersionContentWithHighlights
                      content={compareResult.version1.content || ''}
                      title={compareResult.version1.title}
                      highlights={compareResult.version1Highlights || []}
                      highlightType="added"
                    />
                  </Box>
                </Box>

                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      对比版本内容
                    </Typography>
                    <VersionContentWithHighlights
                      content={compareResult.version2.content || ''}
                      title={compareResult.version2.title}
                      highlights={compareResult.version2Highlights || []}
                      highlightType="removed"
                    />
                  </Box>
                </Box>
              </Box>

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 20, height: 20, bgcolor: '#c8e6c9', border: '1px solid #4caf50' }} />
                    <span>绿色：新增内容</span>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 20, height: 20, bgcolor: '#ffcdd2', border: '1px solid #f44336' }} />
                    <span>红色：删除内容</span>
                  </Box>
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VersionHistoryDialog;

