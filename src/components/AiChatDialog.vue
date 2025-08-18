<!--
  AI对话框组件
  功能：
  1. 提供居中的对话框界面
  2. 支持用户输入和AI回复的显示
  3. 集成Dify API进行AI对话
  4. 解析AI返回的GeoJSON并通知父组件渲染
-->
<template>
  <div class="ai-chat-overlay" v-if="visible">
    <div class="ai-chat-dialog">
      <!-- 对话框头部 -->
      <div class="chat-header">
        <h3>AI地图助手</h3>
        <button class="close-button" @click="closeDialog">×</button>
      </div>
      
      <!-- 消息显示区域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="message in messages" 
          :key="message.id"
          :class="['message', message.type]"
        >
          <div class="message-content">{{ message.content }}</div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
        <div v-if="isLoading" class="message ai loading">
          <div class="message-content">AI正在思考中...</div>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="chat-input-area">
        <input 
          v-model="currentMessage"
          @keyup.enter="sendMessage"
          :disabled="isLoading"
          placeholder="请输入您的问题，例如：显示北京市的边界"
          class="chat-input"
        />
        <button 
          @click="sendMessage" 
          :disabled="isLoading || !currentMessage.trim()"
          class="send-button"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, defineEmits } from 'vue';
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
}>();

// 消息接口定义
interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// 响应式数据
const messages = ref<Message[]>([]);
const currentMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

// Dify API服务实例
const difyService = new DifyApiService();

// 消息ID计数器
let messageIdCounter = 0;

/**
 * 发送消息到AI
 */
const sendMessage = async () => {
  if (!currentMessage.value.trim() || isLoading.value) return;
  
  // 添加用户消息
  const userMessage: Message = {
    id: messageIdCounter++,
    type: 'user',
    content: currentMessage.value,
    timestamp: new Date()
  };
  
  messages.value.push(userMessage);
  const userInput = currentMessage.value;
  currentMessage.value = '';
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
  
  // 设置加载状态
  isLoading.value = true;
  
  try {
    // 调用Dify API
    const response = await difyService.sendMessage(userInput);
    
    // 添加AI回复
    const aiMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: response.content,
      timestamp: new Date()
    };
    
    messages.value.push(aiMessage);
    
    // 检查是否包含GeoJSON数据
    if (response.geoJson) {
      emit('geoJsonReceived', response.geoJson);
    }
    
  } catch (error) {
    console.error('AI对话出错:', error);
    
    // 添加错误消息
    const errorMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: '抱歉，AI服务暂时不可用，请稍后再试。',
      timestamp: new Date()
    };
    
    messages.value.push(errorMessage);
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
 * 添加初始欢迎消息
 */
const addWelcomeMessage = () => {
  if (messages.value.length === 0) {
    const welcomeMessage: Message = {
      id: messageIdCounter++,
      type: 'ai',
      content: '您好！我是AI地图助手，我可以帮您在地图上查找和显示地理信息。请告诉我您想查看什么地方的地理数据。',
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
.ai-chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.ai-chat-dialog {
  background: white;
  border-radius: 12px;
  width: 500px;
  height: 600px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.chat-header {
  background: #2c3e50;
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.message.user {
  align-self: flex-end;
}

.message.user .message-content {
  background: #3498db;
  color: white;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
}

.message.ai .message-content {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 12px 16px;
  border-radius: 18px 18px 18px 4px;
}

.message.loading .message-content {
  background: #ecf0f1;
  color: #7f8c8d;
  padding: 12px 16px;
  border-radius: 18px 18px 18px 4px;
  font-style: italic;
}

.message-content {
  word-wrap: break-word;
  line-height: 1.4;
}

.message-time {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 4px;
  align-self: flex-end;
}

.message.user .message-time {
  align-self: flex-end;
}

.message.ai .message-time {
  align-self: flex-start;
}

.chat-input-area {
  padding: 20px;
  border-top: 1px solid #ecf0f1;
  display: flex;
  gap: 12px;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #bdc3c7;
  border-radius: 24px;
  outline: none;
  font-size: 14px;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #3498db;
}

.chat-input:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

.send-button {
  padding: 12px 24px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #2980b9;
}

.send-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>