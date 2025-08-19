<!--
  AI对话框组件 - AI优先设计版本
  功能：
  1. 提供固定在地图底部中央的对话框界面（AI优先设计）
  2. 支持用户输入和AI回复的显示（支持Markdown渲染）
  3. 集成Dify API进行AI对话
  4. 解析AI返回的GeoJSON并通知父组件渲染
  5. 提供清除按钮和响应式设计
  6. 始终可见，突出AI的核心地位
-->
<template>
  <div class="ai-chat-container" v-if="visible">
    <div class="ai-chat-dialog">
      <!-- 对话框头部 - 添加模式切换 -->
      <div class="chat-header">
        <h3>🤖 AI智能助手</h3>
        <div class="mode-switcher">
          <button 
            :class="['mode-btn', { active: currentMode === 'query' }]"
            @click="switchMode('query')"
            title="自然语言查询助手"
          >
            🗺️ 查询助手
          </button>
          <button 
            :class="['mode-btn', { active: currentMode === 'analysis' }]"
            @click="switchMode('analysis')"
            title="智能分析助手"
          >
            📊 分析助手
          </button>
        </div>
        <div class="header-buttons">
          <button class="clear-button" @click="clearMessages" title="清除对话">
            🗑️
          </button>
          <!-- 移除关闭按钮，AI始终可见 -->
        </div>
      </div>
      
      <!-- 消息显示区域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="message in messages" 
          :key="message.id"
          :class="['message', message.type]"
        >
          <div class="message-content">
            <!-- 流式显示时使用纯文本，避免HTML解析延迟 -->
            <div v-if="message.isStreaming" style="white-space: pre-wrap;">{{ message.content }}</div>
            <div v-else v-html="formatMessageContent(message.content)"></div>
          </div>
          <!-- 流式显示指示器 -->
          <div v-if="message.isStreaming" class="streaming-indicator">
            <div class="streaming-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="streaming-text">正在输入...</span>
          </div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
        <div v-if="isLoading && !hasStreamingMessage" class="message ai loading">
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
          :placeholder="currentMode === 'query' ? '请输入您的问题，例如：显示湾仔区的PVC淡水管线，或显示服役超过30年的铸铁阀门' : '请输入您要分析的问题，例如：分析管线漏损的主要原因，或评估设备维护优先级'"
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
import { ref, nextTick, computed, watch } from 'vue';
import DifyApiService from '../services/DifyApiService';

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
}>();

// 消息接口定义
interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// 响应式数据
const messages = ref<Message[]>([]);
const currentMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const lastError = ref<string | null>(null);
const lastUserMessage = ref<string>('');
const currentMode = ref<'query' | 'analysis'>('query'); // 当前模式：query=自然语言查询，analysis=智能分析

// Dify API服务实例
const difyService = new DifyApiService();

// 消息ID计数器
let messageIdCounter = 0;

// 计算属性：检查是否有流式消息
const hasStreamingMessage = computed(() => {
  return messages.value.some(msg => msg.isStreaming);
});

/**
 * 切换AI模式
 */
const switchMode = (mode: 'query' | 'analysis') => {
  if (currentMode.value === mode) return;
  
  currentMode.value = mode;
  
  // 清除之前的对话，添加新模式的欢迎消息
  clearMessages();
  addWelcomeMessage();
  nextTick(() => scrollToBottom());
};

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
  
  // 创建一个流式显示的AI消息
  const aiMessage: Message = {
    id: messageIdCounter++,
    type: 'ai',
    content: '',
    timestamp: new Date(),
    isStreaming: true
  };
  
  messages.value.push(aiMessage);
  const aiMessageIndex = messages.value.length - 1; // 记录AI消息的索引
  await nextTick();
  scrollToBottom();
  
  try {
    let response;
    
    // 定义流式回调函数
    const onToken = (token: string) => {
      // 无论是哪种模式，都进行增量追加
      aiMessage.content += token;
      
      // 滚动到底部以显示新内容
      nextTick(() => {
        scrollToBottom();
      });
    };
    
    const onEvent = (event: any) => {
      // 根据事件类型处理
      if (event.event === 'node_started') {
        // 显示节点开始信息
        console.log('正在执行:', event.data?.title);
      } else if (event.event === 'node_finished') {
        console.log('完成节点:', event.data?.title);
      }
    };
    
    // 根据当前模式调用不同的API
    if (currentMode.value === 'query') {
      // 自然语言查询助手 - 调用工作流API
      response = await difyService.sendMessage(lastUserMessage.value, {
        onToken,
        onEvent,
        signal: undefined
      });
    } else {
      // 智能分析助手 - 调用智能体API
      response = await difyService.sendAgentMessage(lastUserMessage.value, {
        onToken,
        onEvent,
        signal: undefined
      });
    }
    
    // 更新AI消息的最终状态
    aiMessage.isStreaming = false;
    
    // 如果流式更新后内容为空，则使用最终响应内容
    if (!aiMessage.content && response.content) {
      aiMessage.content = response.content;
    }
    
    // 通过索引更新来确保最终状态也被正确更新
    messages.value[aiMessageIndex] = { ...aiMessage };
    
    // 查询模式才处理GeoJSON数据
    if (currentMode.value === 'query' && response.geoJson) {
      emit('geoJsonReceived', response.geoJson);
    }
    
  } catch (error) {
    console.error('AI对话出错:', error);
    lastError.value = error.message || 'AI服务暂时不可用，请稍后再试。';
    
    // 移除失败的AI消息
    const index = messages.value.findIndex(msg => msg.id === aiMessage.id);
    if (index > -1) {
      messages.value.splice(index, 1);
    }
  } finally {
    isLoading.value = false;
    await nextTick();
    scrollToBottom();
  }
};

/**
 * 关闭对话框
 */
/**
 * 关闭对话框 - 在AI优先设计中不再执行关闭操作
 */
const closeDialog = () => {
  // AI对话框始终可见，不执行关闭操作
  console.log('AI对话框始终可见，AI优先设计');
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
    let welcomeContent;
    
    if (currentMode.value === 'query') {
      welcomeContent = '您好！我是**自然语言查询助手**，我可以帮您在地图上查找和显示地理信息。请告诉我您想查看什么地方的地理数据。\n\n例如：\n- 显示湾仔区的PVC淡水管线\n- 查看服役超过30年的铸铁阀门\n- 标记中环区的水务设施';
    } else {
      welcomeContent = '您好！我是**智能分析助手**，我可以为您提供水务数据的深度分析和洞察。请告诉我您想要分析的问题。\n\n例如：\n- 分析管线漏损的主要原因\n- 评估设备维护优先级\n- 预测未来的设备更换需求';
    }
    
    const welcomeMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: welcomeContent,
      timestamp: new Date()
    };
    messages.value.push(welcomeMessage);
  }
};

// 监听对话框显示状态，显示时添加欢迎消息
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    addWelcomeMessage();
    nextTick(() => scrollToBottom());
  }
});
</script>

<style scoped>
/* AI对话框容器 - 底部中央固定定位，突出AI地位 */
.ai-chat-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 40%;
  min-width: 400px;
  max-width: 600px;
  max-height: 60vh;
  z-index: 1000;
  animation: slideInUp 0.3s ease-out;
}

/* 响应式设计 - 移动端，保持底部中央定位 */
@media (max-width: 768px) {
  .ai-chat-container {
    width: 85%;
    bottom: 10px;
    min-width: unset;
    max-width: unset;
    left: 50%;
    transform: translateX(-50%);
  }
}

@media (max-width: 480px) {
  .ai-chat-container {
    width: 95%;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .mode-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .chat-header h3 {
    font-size: 16px;
  }
}

/* 滑入动画 - 从底部向上滑入 */
@keyframes slideInUp {
  from {
    transform: translateX(-50%) translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
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

/* 模式切换器样式 */
.mode-switcher {
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 4px;
}

.mode-btn {
  background: none;
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mode-btn.active {
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

/* 流式显示指示器 */
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  opacity: 0.7;
}

.streaming-dots {
  display: flex;
  gap: 3px;
}

.streaming-dots span {
  width: 4px;
  height: 4px;
  background: #3498db;
  border-radius: 50%;
  animation: streamingPulse 1.2s infinite ease-in-out both;
}

.streaming-dots span:nth-child(1) { animation-delay: -0.24s; }
.streaming-dots span:nth-child(2) { animation-delay: -0.12s; }

@keyframes streamingPulse {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.streaming-text {
  color: #7f8c8d;
  font-style: italic;
  font-size: 12px;
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