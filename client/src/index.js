// 导入 React 库，用于构建用户界面
import React from 'react';
// 导入 ReactDOM 的客户端渲染方法，用于将 React 组件渲染到 DOM 中
import ReactDOM from 'react-dom/client';
// 导入全局样式文件
import './index.css';
// 导入主应用组件
import App from './App';

// 获取 HTML 中 id 为 'root' 的 DOM 元素，并创建 React 根节点
// 这是 React 18 的新 API，用于创建根容器
const root = ReactDOM.createRoot(document.getElementById('root'));

// 将 App 组件渲染到根节点中
// React.StrictMode 是 React 的严格模式，用于：
// 1. 识别不安全的生命周期
// 2. 检测过时的 API 使用
// 3. 检测意外的副作用
// 4. 检测已废弃的 API
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


