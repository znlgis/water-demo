/**
 * Dify API服务类
 * 提供与Dify平台AI对话的接口
 * 
 * 功能：
 * - 发送用户消息到Dify AI
 * - 解析AI回复中的GeoJSON数据
 * - 处理API错误和异常情况
 */

import axios from 'axios';

export default class DifyApiService {
  // Dify API配置
  baseUrl;
  apiKey;
  conversationId = null;

  constructor() {
    // 从环境变量或配置中获取Dify API设置
    // 在实际部署时需要配置正确的Dify API端点和密钥
    this.baseUrl = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1';
    this.apiKey = import.meta.env.VITE_DIFY_API_KEY || 'your-dify-api-key';
    
    // 如果没有配置环境变量，使用模拟数据
    if (this.apiKey === 'your-dify-api-key') {
      console.warn('Dify API key not configured, using mock data');
    }
  }

  /**
   * 发送消息到Dify AI
   * 
   * @param message 用户输入的消息
   * @returns AI回复，包含内容和可能的GeoJSON数据
   */
  async sendMessage(message) {
    try {
      // 如果API key未配置，返回模拟数据
      if (this.apiKey === 'your-dify-api-key') {
        return this.getMockResponse(message);
      }

      // 构建请求数据
      const requestData = {
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: this.conversationId || '',
        user: 'map-user'
      };

      // 发送请求到Dify API
      const response = await axios.post(
        `${this.baseUrl}/chat-messages`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 保存会话ID以维持对话上下文
      if (response.data.conversation_id) {
        this.conversationId = response.data.conversation_id;
      }

      // 解析AI回复
      const aiContent = response.data.answer || '抱歉，我没有理解您的问题。';
      
      // 尝试从回复中提取GeoJSON
      const geoJson = this.extractGeoJsonFromResponse(aiContent);

      return {
        content: aiContent,
        geoJson: geoJson
      };

    } catch (error) {
      console.error('Dify API调用失败:', error);
      
      // 返回错误消息
      throw new Error('AI服务暂时不可用，请稍后再试。');
    }
  }

  /**
   * 从AI回复中提取GeoJSON数据
   * 
   * @param content AI回复内容
   * @returns 提取的GeoJSON对象，如果没有则返回null
   */
  extractGeoJsonFromResponse(content) {
    try {
      // 查找GeoJSON格式的数据块
      const geoJsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/g;
      const matches = geoJsonRegex.exec(content);
      
      if (matches && matches[1]) {
        const geoJsonText = matches[1];
        const geoJson = JSON.parse(geoJsonText);
        
        // 验证是否为有效的GeoJSON
        if (geoJson.type && (geoJson.type === 'FeatureCollection' || geoJson.type === 'Feature')) {
          return geoJson;
        }
      }

      // 尝试直接解析JSON格式的GeoJSON
      const jsonBlocks = content.match(/\{[^{}]*"type"[^{}]*"(Feature|FeatureCollection)"[^{}]*\}/g);
      if (jsonBlocks && jsonBlocks.length > 0) {
        const geoJson = JSON.parse(jsonBlocks[0]);
        return geoJson;
      }

      return null;
    } catch (error) {
      console.warn('解析GeoJSON失败:', error);
      return null;
    }
  }

  /**
   * 生成模拟AI回复数据（用于开发和测试）
   * 
   * @param message 用户消息
   * @returns 模拟的AI回复
   */
  getMockResponse(message) {
    // 模拟延时
    return new Promise((resolve) => {
      setTimeout(() => {
        // 根据用户输入生成相应的模拟回复
        let content = '';
        let geoJson = null;

        if (message.includes('北京') || message.includes('beijing')) {
          content = '为您显示**北京市**的地理边界信息。这是北京市的行政区域范围，包含了主要的*城区*和*郊区*。\n\n`坐标范围`: 116.4074°E, 39.9042°N';
          geoJson = this.generateMockGeoJson('北京市', [116.4074, 39.9042]);
        } else if (message.includes('上海') || message.includes('shanghai')) {
          content = '为您显示**上海市**的地理边界信息。上海是中国的*经济中心*，这里展示的是其行政区域范围。\n\n`特点`: 国际化大都市';
          geoJson = this.generateMockGeoJson('上海市', [121.4737, 31.2304]);
        } else if (message.includes('深圳') || message.includes('shenzhen')) {
          content = '为您显示**深圳市**的地理边界信息。深圳是中国的*特色经济特区*，地理位置优越。\n\n`成立时间`: 1980年\n`地位`: 经济特区';
          geoJson = this.generateMockGeoJson('深圳市', [114.0579, 22.5431]);
        } else if (message.includes('点') || message.includes('位置') || message.includes('坐标')) {
          content = '为您在地图上标记了一个**示例位置点**。您可以指定具体的地名或坐标。\n\n*提示*: 可以试试输入具体的`经纬度坐标`。';
          geoJson = this.generateMockPointGeoJson([112, 25]);
        } else {
          content = '我理解您想在地图上查看地理信息。请告诉我具体的地名，比如*"北京"*、*"上海"*等，我会为您在地图上显示相应的地理数据。\n\n**支持的功能**:\n- 显示城市边界\n- 标记位置点\n- 查看区域信息';
        }

        resolve({ content, geoJson });
      }, 1000); // 模拟1秒延时
    });
  }

  /**
   * 生成模拟的区域GeoJSON数据
   */
  generateMockGeoJson(name, center) {
    // 生成一个简单的矩形区域
    const offset = 0.5;
    return {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "name": name
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [center[0] - offset, center[1] - offset],
              [center[0] + offset, center[1] - offset],
              [center[0] + offset, center[1] + offset],
              [center[0] - offset, center[1] + offset],
              [center[0] - offset, center[1] - offset]
            ]]
          }
        }
      ]
    };
  }

  /**
   * 生成模拟的点GeoJSON数据
   */
  generateMockPointGeoJson(coordinates) {
    return {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "name": "示例位置点"
          },
          "geometry": {
            "type": "Point",
            "coordinates": coordinates
          }
        }
      ]
    };
  }
}