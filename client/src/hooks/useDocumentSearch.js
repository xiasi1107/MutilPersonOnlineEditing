import { useState, useCallback, useEffect } from 'react';

/**
 * 文档搜索 Hook
 * 处理文档内容搜索、高亮、导航等功能
 */
export const useDocumentSearch = (quillRef) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);

  const clearSearchHighlights = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const text = quill.getText();
    const length = text.length;
    if (length > 0) {
      try {
        let index = 0;
        while (index < length) {
          const format = quill.getFormat(index, 1);
          if (format.background) {
            let start = index;
            let end = index;
            while (end < length) {
              const nextFormat = quill.getFormat(end, 1);
              if (nextFormat.background) {
                end++;
              } else {
                break;
              }
            }
            quill.formatText(start, end - start, 'background', false);
            index = end;
          } else {
            index++;
          }
        }
      } catch (error) {
        quill.formatText(0, length, 'background', false);
      }
    }
  }, [quillRef]);

  const highlightSearchResults = useCallback((matches, currentIndex) => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !matches || matches.length === 0) return;

    matches.forEach((match, index) => {
      const isCurrent = index === currentIndex;
      quill.formatText(match.index, match.length, 'background', isCurrent ? '#ff9800' : '#ffeb3b');
    });

    if (currentIndex >= 0 && currentIndex < matches.length) {
      const currentMatch = matches[currentIndex];
      const line = quill.getLine(currentMatch.index);
      if (line && line[0] && line[0].domNode) {
        line[0].domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [quillRef]);

  const performSearch = useCallback((keyword) => {
    clearSearchHighlights();
    
    if (!keyword || !keyword.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const text = quill.getText();
    const keywordLower = keyword.toLowerCase();
    const matches = [];
    let index = 0;

    while ((index = text.toLowerCase().indexOf(keywordLower, index)) !== -1) {
      matches.push({
        index: index,
        length: keyword.length
      });
      index += keyword.length;
    }

    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);

    if (matches.length > 0) {
      highlightSearchResults(matches, 0);
    }
  }, [clearSearchHighlights, highlightSearchResults, quillRef]);

  const navigateToPreviousMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const newIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(newIndex);
    highlightSearchResults(searchMatches, newIndex);
  }, [searchMatches, currentMatchIndex, highlightSearchResults]);

  const navigateToNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const newIndex = currentMatchIndex >= searchMatches.length - 1 ? 0 : currentMatchIndex + 1;
    setCurrentMatchIndex(newIndex);
    highlightSearchResults(searchMatches, newIndex);
  }, [searchMatches, currentMatchIndex, highlightSearchResults]);

  const closeSearch = useCallback(() => {
    setSearchKeyword('');
    setSearchMatches([]);
    setCurrentMatchIndex(-1);
    setSearchOpen(false);
    clearSearchHighlights();
  }, [clearSearchHighlights]);

  useEffect(() => {
    if (searchOpen) {
      performSearch(searchKeyword);
    } else {
      clearSearchHighlights();
    }
  }, [searchKeyword, searchOpen, performSearch, clearSearchHighlights]);

  // 监听键盘快捷键（Ctrl+F）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchOpen, closeSearch]);

  return {
    searchKeyword,
    setSearchKeyword,
    searchMatches,
    currentMatchIndex,
    searchOpen,
    setSearchOpen,
    navigateToPreviousMatch,
    navigateToNextMatch,
    closeSearch
  };
};

