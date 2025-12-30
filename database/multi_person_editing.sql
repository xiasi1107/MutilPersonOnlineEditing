/*
 Navicat Premium Dump SQL

 Source Server         : xs
 Source Server Type    : MySQL
 Source Server Version : 80043 (8.0.43)
 Source Host           : localhost:3306
 Source Schema         : multi_person_editing

 Target Server Type    : MySQL
 Target Server Version : 80043 (8.0.43)
 File Encoding         : 65001

 Date: 15/12/2025 15:57:52
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for comments
-- ----------------------------
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `documentId` int NOT NULL COMMENT '文档ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
  `position` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '评论位置（行号或选择范围）',
  `parentId` int NULL DEFAULT NULL COMMENT '父评论ID（用于回复）',
  `mentions` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '提及的用户ID（逗号分隔）',
  `isResolved` tinyint(1) NULL DEFAULT 0 COMMENT '是否已解决',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_documentId`(`documentId` ASC) USING BTREE,
  INDEX `idx_userId`(`userId` ASC) USING BTREE,
  INDEX `idx_parentId`(`parentId` ASC) USING BTREE,
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`documentId`) REFERENCES `documents` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`parentId`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '评论表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for document_permissions
-- ----------------------------
DROP TABLE IF EXISTS `document_permissions`;
CREATE TABLE `document_permissions`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  `documentId` int NOT NULL COMMENT '文档ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `permission` enum('read','write','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'read' COMMENT '权限：只读、编辑、管理员',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_document_user`(`documentId` ASC, `userId` ASC) USING BTREE,
  INDEX `idx_documentId`(`documentId` ASC) USING BTREE,
  INDEX `idx_userId`(`userId` ASC) USING BTREE,
  CONSTRAINT `document_permissions_ibfk_1` FOREIGN KEY (`documentId`) REFERENCES `documents` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `document_permissions_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 21 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文档权限表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for document_templates
-- ----------------------------
DROP TABLE IF EXISTS `document_templates`;
CREATE TABLE `document_templates`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `isPublic` tinyint(1) NOT NULL,
  `creatorId` int NOT NULL,
  `usageCount` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_document_templates_category`(`category` ASC) USING BTREE,
  INDEX `ix_document_templates_creatorId`(`creatorId` ASC) USING BTREE,
  INDEX `ix_document_templates_id`(`id` ASC) USING BTREE,
  INDEX `ix_document_templates_name`(`name` ASC) USING BTREE,
  INDEX `ix_document_templates_isPublic`(`isPublic` ASC) USING BTREE,
  CONSTRAINT `document_templates_ibfk_1` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for document_versions
-- ----------------------------
DROP TABLE IF EXISTS `document_versions`;
CREATE TABLE `document_versions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `versionNumber` int NOT NULL,
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isLocked` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_document_versions_versionNumber`(`versionNumber` ASC) USING BTREE,
  INDEX `ix_document_versions_createdAt`(`createdAt` ASC) USING BTREE,
  INDEX `ix_document_versions_documentId`(`documentId` ASC) USING BTREE,
  INDEX `ix_document_versions_createdBy`(`createdBy` ASC) USING BTREE,
  INDEX `ix_document_versions_id`(`id` ASC) USING BTREE,
  CONSTRAINT `document_versions_ibfk_1` FOREIGN KEY (`documentId`) REFERENCES `documents` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `document_versions_ibfk_2` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 46 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for documents
-- ----------------------------
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '文档ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文档标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '文档内容',
  `tags` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '标签（逗号分隔）',
  `folder` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '文件夹路径',
  `creatorId` int NOT NULL COMMENT '创建者ID',
  `isPublic` tinyint(1) NULL DEFAULT 0 COMMENT '是否公开',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'draft' COMMENT '状态：草稿、已发布、已归档',
  `lastEditedAt` datetime NULL DEFAULT NULL COMMENT '最后编辑时间',
  `lastEditedBy` int NULL DEFAULT NULL COMMENT '最后编辑者ID',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `isLocked` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `lastEditedBy`(`lastEditedBy` ASC) USING BTREE,
  INDEX `idx_creatorId`(`creatorId` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_isPublic`(`isPublic` ASC) USING BTREE,
  FULLTEXT INDEX `idx_content`(`title`, `content`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`lastEditedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 20 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文档表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for notifications
-- ----------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `type` enum('edit','comment','task','mention','permission','system','video_conference') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知类型：编辑、评论、任务、提及、权限、系统、视频会议',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '通知内容',
  `relatedId` int NULL DEFAULT NULL COMMENT '关联ID（文档ID、评论ID等）',
  `isRead` tinyint(1) NULL DEFAULT 0 COMMENT '是否已读',
  `readAt` datetime NULL DEFAULT NULL COMMENT '阅读时间',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_userId`(`userId` ASC) USING BTREE,
  INDEX `idx_isRead`(`isRead` ASC) USING BTREE,
  INDEX `idx_type`(`type` ASC) USING BTREE,
  INDEX `idx_user_read`(`userId` ASC, `isRead` ASC) USING BTREE,
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 14 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '通知表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for operation_logs
-- ----------------------------
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `documentId` int NULL DEFAULT NULL COMMENT '文档ID',
  `action` enum('create','read','update','delete','share','export','import') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型：创建、读取、更新、删除、分享、导出、导入',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '操作描述',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_userId`(`userId` ASC) USING BTREE,
  INDEX `idx_documentId`(`documentId` ASC) USING BTREE,
  INDEX `idx_action`(`action` ASC) USING BTREE,
  INDEX `idx_createdAt`(`createdAt` ASC) USING BTREE,
  CONSTRAINT `operation_logs_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `operation_logs_ibfk_2` FOREIGN KEY (`documentId`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1147 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '操作日志表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for password_reset_tokens
-- ----------------------------
DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime NOT NULL,
  `used` tinyint(1) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `ix_password_reset_tokens_token`(`token` ASC) USING BTREE,
  INDEX `ix_password_reset_tokens_expiresAt`(`expiresAt` ASC) USING BTREE,
  INDEX `ix_password_reset_tokens_used`(`used` ASC) USING BTREE,
  INDEX `ix_password_reset_tokens_userId`(`userId` ASC) USING BTREE,
  INDEX `ix_password_reset_tokens_id`(`id` ASC) USING BTREE,
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tasks
-- ----------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `documentId` int NULL DEFAULT NULL COMMENT '关联文档ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '任务描述',
  `creatorId` int NOT NULL COMMENT '创建者ID',
  `assigneeId` int NOT NULL COMMENT '分配者ID',
  `status` enum('pending','in_progress','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'pending' COMMENT '状态：待处理、进行中、已完成、已取消',
  `priority` enum('low','medium','high') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'medium' COMMENT '优先级：低、中、高',
  `dueDate` datetime NULL DEFAULT NULL COMMENT '截止日期',
  `completedAt` datetime NULL DEFAULT NULL COMMENT '完成时间',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_documentId`(`documentId` ASC) USING BTREE,
  INDEX `idx_creatorId`(`creatorId` ASC) USING BTREE,
  INDEX `idx_assigneeId`(`assigneeId` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`documentId`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `tasks_ibfk_3` FOREIGN KEY (`assigneeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '任务表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for user_folders
-- ----------------------------
DROP TABLE IF EXISTS `user_folders`;
CREATE TABLE `user_folders`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` int NULL DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `parentId`(`parentId` ASC) USING BTREE,
  INDEX `ix_user_folders_id`(`id` ASC) USING BTREE,
  INDEX `ix_user_folders_userId`(`userId` ASC) USING BTREE,
  CONSTRAINT `user_folders_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `user_folders_ibfk_2` FOREIGN KEY (`parentId`) REFERENCES `user_folders` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for user_tags
-- ----------------------------
DROP TABLE IF EXISTS `user_tags`;
CREATE TABLE `user_tags`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_user_tags_userId`(`userId` ASC) USING BTREE,
  INDEX `ix_user_tags_id`(`id` ASC) USING BTREE,
  CONSTRAINT `user_tags_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户名',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '邮箱',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '手机号',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码（加密）',
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '昵称',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像路径',
  `role` enum('admin','editor','viewer') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'viewer' COMMENT '角色：管理员、编辑者、查看者',
  `status` enum('active','inactive','banned') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'active' COMMENT '状态：活跃、非活跃、禁用',
  `lastLoginAt` datetime NULL DEFAULT NULL COMMENT '最后登录时间',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email`(`email` ASC) USING BTREE,
  UNIQUE INDEX `phone`(`phone` ASC) USING BTREE,
  INDEX `idx_username`(`username` ASC) USING BTREE,
  INDEX `idx_email`(`email` ASC) USING BTREE,
  INDEX `idx_phone`(`phone` ASC) USING BTREE,
  INDEX `idx_role`(`role` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户表' ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
