<!--
  AI对话框组件
  功能：
  1. 提供固定悬浮的对话框界面（非遮挡核心区域）
  2. 支持用户输入和AI回复的显示（支持Markdown渲染）
  3. 集成Dify API进行AI对话
  4. 解析AI返回的GeoJSON并通知父组件渲染
  5. 提供清除按钮和响应式设计
-->
<template>
  <div class="ai-chat-container" v-if="visible">
    <div class="ai-chat-dialog">
      <!-- 对话框头部 -->
      <div class="chat-header">
        <h3>🤖 AI地图助手</h3>
        <div class="header-buttons">
          <button class="clear-button" @click="clearMessages" title="清除对话">
            🗑️
          </button>
          <button class="close-button" @click="closeDialog" title="关闭">×</button>
        </div>
      </div>
      
      <!-- 消息显示区域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="message in messages" 
          :key="message.id"
          :class="['message', message.type]"
        >
          <div class="message-content" v-html="formatMessageContent(message.content)"></div>
          <!-- 额外数据展示区域 -->
          <div v-if="message.additionalData" class="additional-data-container">
            <WaterDataVisualization :data="message.additionalData" />
          </div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
        <div v-if="isLoading" class="message ai loading">
          <div class="loading-indicator">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="loading-text">AI正在思考中...</div>
          </div>
        </div>
        <!-- 错误重试区域 -->
        <div v-if="lastError" class="error-message">
          <div class="error-content">{{ lastError }}</div>
          <button class="retry-button" @click="retryLastMessage">重试</button>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="chat-input-area">
        <input 
          v-model="currentMessage"
          @keyup.enter="sendMessage"
          :disabled="isLoading"
          placeholder="请输入您的问题，例如：显示湾仔区的PVC淡水管线，或显示服役超过30年的铸铁阀门"
          class="chat-input"
        />
        <button 
          @click="sendMessage" 
          :disabled="isLoading || !currentMessage.trim()"
          class="send-button"
        >
          <span v-if="!isLoading">发送</span>
          <span v-else>...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, defineEmits } from 'vue';
import DifyApiService from '../services/DifyApiService';
import WaterDataVisualization from './WaterDataVisualization.vue';

// 组件属性
interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

// 事件定义
const emit = defineEmits<{
  close: [];
  geoJsonReceived: [geoJson: any];
  clearLayers: [];
  additionalDataReceived: [data: any];
}>();

// 消息接口定义
interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  additionalData?: any;
}

// 响应式数据
const messages = ref<Message[]>([]);
const currentMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const lastError = ref<string | null>(null);
const lastUserMessage = ref<string>('');

// Dify API服务实例
const difyService = new DifyApiService();

// 消息ID计数器
let messageIdCounter = 0;

/**
 * 发送消息到AI
 */
const sendMessage = async () => {
  if (!currentMessage.value.trim() || isLoading.value) return;
  
  // 清除之前的错误
  lastError.value = null;
  
  // 添加用户消息
  const userMessage: Message = {
    id: messageIdCounter++,
    type: 'user',
    content: currentMessage.value,
    timestamp: new Date()
  };
  
  messages.value.push(userMessage);
  lastUserMessage.value = currentMessage.value;
  currentMessage.value = '';
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
  
  // 设置加载状态
  isLoading.value = true;
  
  try {
    // 调用Dify API
    const response = await difyService.sendMessage(lastUserMessage.value);
    
    // 添加AI回复
    const aiMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: response.content,
      timestamp: new Date(),
      additionalData: response.additionalData || null
    };
    
    messages.value.push(aiMessage);
    
    // 检查是否包含GeoJSON数据
    if (response.geoJson) {
      emit('geoJsonReceived', response.geoJson);
    }

    // 处理额外数据（如统计图表、验证结果等）
    if (response.additionalData) {
      emit('additionalDataReceived', response.additionalData);
    }
    
  } catch (error) {
    console.error('AI对话出错:', error);
    lastError.value = error.message || 'AI服务暂时不可用，请稍后再试。';
  } finally {
    isLoading.value = false;
    await nextTick();
    scrollToBottom();
  }
};

/**
 * 关闭对话框
 */
const closeDialog = () => {
  emit('close');
};

/**
 * 清除所有消息
 */
const clearMessages = () => {
  messages.value = [];
  lastError.value = null;
  messageIdCounter = 0;
  // 清除地图上的GeoJSON图层
  emit('clearLayers');
  // 清除后重新添加欢迎消息
  addWelcomeMessage();
  nextTick(() => scrollToBottom());
};

/**
 * 重试上一条消息
 */
const retryLastMessage = async () => {
  if (lastUserMessage.value && !isLoading.value) {
    lastError.value = null;
    currentMessage.value = lastUserMessage.value;
    await sendMessage();
  }
};

/**
 * 滚动到消息底部
 */
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

/**
 * 格式化时间显示
 */
const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * 格式化消息内容，支持基本Markdown
 */
const formatMessageContent = (content: string): string => {
  // 简单的Markdown支持
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
};

/**
 * 添加初始欢迎消息
 */
const addWelcomeMessage = () => {
  if (messages.value.length === 0) {
    const welcomeMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: '您好！我是**AI地图助手**，我可以帮您在地图上查找和显示地理信息。请告诉我您想查看什么地方的地理数据。\n\n例如：\n- 显示北京市的边界\n- 标记上海市的位置\n- 查看深圳市区域',
      timestamp: new Date()
    };
    messages.value.push(welcomeMessage);
  }
};

// 监听对话框显示状态，显示时添加欢迎消息
import { watch } from 'vue';
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    addWelcomeMessage();
    nextTick(() => scrollToBottom());
  }
});
</script>

<style scoped>
/* 固定悬浮容器 - 半透明卡片设计 */
.ai-chat-container {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 30%;
  min-width: 350px;
  max-width: 500px;
  max-height: 80vh;
  z-index: 1000;
  animation: slideInRight 0.3s ease-out;
}

/* 响应式设计 - 移动端 */
@media (max-width: 768px) {
  .ai-chat-container {
    width: 80%;
    top: 10px;
    right: 10px;
    left: 10px;
    min-width: unset;
    max-width: unset;
  }
}

@media (max-width: 480px) {
  .ai-chat-container {
    width: 95%;
    top: 5px;
    right: 2.5%;
    left: 2.5%;
  }
}

/* 滑入动画 */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 对话框主体 - 半透明背景 + 阴影 */
.ai-chat-dialog {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  max-height: 80vh;
}

/* 头部样式 */
.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 16px 16px 0 0;
}

.chat-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.clear-button,
.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.clear-button:hover,
.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.close-button {
  font-size: 20px;
  font-weight: bold;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
  max-height: 400px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  align-self: flex-end;
}

.message.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.message.ai .message-content {
  background: rgba(236, 240, 241, 0.9);
  color: #2c3e50;
  padding: 12px 16px;
  border-radius: 18px 18px 18px 4px;
  border: 1px solid rgba(52, 152, 219, 0.1);
}

/* 加载指示器 */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(236, 240, 241, 0.9);
  padding: 12px 16px;
  border-radius: 18px 18px 18px 4px;
  border: 1px solid rgba(52, 152, 219, 0.1);
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #3498db;
  border-radius: 50%;
  animation: loadingPulse 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes loadingPulse {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.loading-text {
  color: #7f8c8d;
  font-style: italic;
  font-size: 14px;
}

/* 错误消息样式 */
.error-message {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 12px;
  padding: 12px;
  margin: 8px 0;
  animation: shakeError 0.5s ease;
}

@keyframes shakeError {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.error-content {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 8px;
}

.retry-button {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: #c0392b;
}

/* 消息内容样式 */
.message-content {
  word-wrap: break-word;
  line-height: 1.5;
  font-size: 14px;
}

.message-content strong {
  font-weight: 600;
}

.message-content em {
  font-style: italic;
}

.message-content code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.message-time {
  font-size: 11px;
  color: #95a5a6;
  margin-top: 4px;
  opacity: 0.8;
}

.message.user .message-time {
  align-self: flex-end;
}

.message.ai .message-time {
  align-self: flex-start;
}

/* 输入区域 */
.chat-input-area {
  padding: 16px;
  border-top: 1px solid rgba(189, 195, 199, 0.3);
  display: flex;
  gap: 12px;
  backdrop-filter: blur(5px);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 0 0 16px 16px;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(189, 195, 199, 0.4);
  border-radius: 25px;
  outline: none;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.2s ease;
}

.chat-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background-color: rgba(248, 249, 250, 0.8);
  cursor: not-allowed;
}

.send-button {
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.send-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(241, 241, 241, 0.5);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(193, 193, 193, 0.7);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(168, 168, 168, 0.8);
}
</style>