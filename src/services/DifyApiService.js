/**
 * Dify API服务类
 * 提供与Dify平台AI对话的接口
 *
 * 功能：
 * - 发送用户消息到Dify AI
 * - 解析AI回复中的GeoJSON数据
 * - 处理API错误和异常情况
 */

import axios from "axios";

export default class DifyApiService {
  // Dify API配置
  baseUrl;
  apiKeyWorkflow;
  apiKeyAgent;
  conversationId = null;

  constructor() {
    // 从环境变量或配置中获取Dify API设置
    // 在实际部署时需要配置正确的Dify API端点和密钥
    this.baseUrl = "http://127.0.0.1:580/v1";
    this.apiKeyWorkflow = "app-d86VpODIGUAafLAWyKtBpGmX";
    this.apiKeyAgent = "app-ZyYzp25wkHgbwTc0eRbq7otz";
  }

  /**
   * 发送消息到Dify AI工作流API (自然语言查询助手)
   * 以流式获取回答，实时回调增量，再组装完整结果做后处理
   * @param {string} message
   * @param {Object} opts
   * @param {function(string):void} opts.onToken  每个增量token回调
   * @param {function(Object):void} opts.onEvent  原始事件回调 (eventObj)
   * @param {AbortSignal} opts.signal  可选中断
   * @returns {Promise<{content:string, geoJson:Object|null}>}
   */
  async sendMessage(message, opts = {}) {
    const { onToken, onEvent, signal } = opts;
    
    // 使用streaming模式进行流式对话
    const requestData = {
      inputs: { ms: message },
      response_mode: "streaming",
      conversation_id: this.conversationId || "",
      user: "map-user",
    };

    try {
      const response = await fetch(`${this.baseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKeyWorkflow}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取流式响应');
      }

      let fullContent = '';
      let finalData = null;
      const decoder = new TextDecoder();

      try {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6);
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (onEvent) onEvent(data);

                // 处理不同类型的流式事件
                if (data.event === 'text_chunk' || data.event === 'text_replace') {
                  const text = data.data?.text || '';
                  if (text) {
                    fullContent += text;
                    if (onToken) {
                      onToken(text);
                    }
                  }
                } else if (data.event === 'workflow_finished') {
                  finalData = data.data;
                } else if (data.event === 'node_finished') {
                  // 处理节点完成事件，可能包含最终输出
                  if (data.data?.outputs) {
                    finalData = data.data;
                  }
                } else if (data.event === 'node_started') {
                  // 节点开始，可以显示进度
                  console.log('节点开始:', data.data?.title);
                }
              } catch (parseError) {
                console.warn('解析SSE数据失败:', parseError, '原始数据:', jsonStr);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 如果有最终数据，解析GeoJSON
      let geoJson = [];
      if (finalData?.outputs?.data) {
        const content = finalData.outputs.data;
        const parsed = this._safeParseJson(content);
        const arr = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];

        for (const item of arr) {
          const geom = item.geom;
          geoJson.push(this._safeParseJson(geom));
        }
      }

      console.log("AI解析后的数组:", geoJson);

      return {
        content: fullContent || "（无内容）",
        geoJson,
      };
    } catch (err) {
      if (signal?.aborted) throw new Error("已取消");
      throw new Error(err?.message || "AI服务调用失败");
    }
  }

  /**
   * 发送消息到Dify智能体API (智能分析助手)
   * 调用chat-messages接口，实时返回AI分析结果
   * @param {string} message
   * @param {Object} opts
   * @param {function(string):void} opts.onToken  每个增量token回调
   * @param {function(Object):void} opts.onEvent  原始事件回调 (eventObj)
   * @param {AbortSignal} opts.signal  可选中断
   * @returns {Promise<{content:string}>}
   */
  async sendAgentMessage(message, opts = {}) {
    const { onToken, onEvent, signal } = opts;
    
    const requestData = {
      inputs: {},
      query: message,
      response_mode: "streaming",
      conversation_id: this.conversationId || "",
      user: "analysis-user",
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKeyAgent}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal
      });

      if (!response.ok) {
        throw new Error(`智能体API请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取流式响应');
      }

      let fullContent = '';
      let conversationId = null;
      let metadata = null;
      const decoder = new TextDecoder();

      try {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6);
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (onEvent) onEvent(data);

                // 处理不同类型的流式事件
                if (data.event === 'message' || data.event === 'agent_message') {
                  // 智能体的消息事件 - 通常是增量更新
                  const text = data.answer || '';
                  if (text) {
                    if (onToken) onToken(text);
                  }
                } else if (data.event === 'message_end') {
                  // 保存会话ID和元数据
                  conversationId = data.conversation_id;
                  metadata = data.metadata;
                } else if (data.event === 'message_replace') {
                  // 智能体完整内容替换事件
                  const text = data.answer || '';
                  if (text) {
                    // 这种情况下，应该清空之前的内容
                    // 但为了统一处理，我们还是发送增量
                    if (onToken) onToken(text);
                  }
                }
              } catch (parseError) {
                console.warn('解析智能体SSE数据失败:', parseError, '原始数据:', jsonStr);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 保存会话ID用于后续对话
      if (conversationId) {
        this.conversationId = conversationId;
      }

      return {
        content: fullContent
      };
    } catch (err) {
      if (signal?.aborted) throw new Error("已取消");
      throw new Error(err?.message || "智能分析服务调用失败");
    }
  }

  _safeParseJson(input) {
    if (input == null) return null;
    if (typeof input === "object") return input;

    let text = String(input).trim();
    if (!text) return null;

    // 去掉代码块围栏
    if (text.startsWith("```")) {
      text = text
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    let result = tryParse(text);
    if (result == null) {
      // 抽取首个 JSON 片段
      const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) result = tryParse(match[1]);
    }

    // 处理双重编码
    if (typeof result === "string") {
      const second = tryParse(result.trim());
      if (second != null) result = second;
    }

    return result;

    function tryParse(str) {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    }
  }

  // ========== 新增的API接口方法（为后端对接准备） ==========

  /**
   * 资产定位API接口
   * @param {Object} params - 查询参数 {area, material, assetType}
   * @returns {Promise} API响应
   */
  async queryAssetLocation(params) {
    // 实际API调用
    const requestData = {
      inputs: { query_type: "asset_location", ...params },
      query: `查询${params.area}的${params.material}${params.assetType}`,
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "water-system-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error("资产定位查询失败");
    }
  }

  /**
   * 资产生命周期分析API接口
   */
  async queryAssetLifecycle(params) {
    const requestData = {
      inputs: { query_type: "asset_lifecycle", ...params },
      query: `分析服役超过${params.years}年的${params.assetType}`,
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "water-system-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error("生命周期分析失败");
    }
  }

  /**
   * 漏损分析API接口
   */
  async queryLeakAnalysis(params = {}) {
    const requestData = {
      inputs: { query_type: "leak_analysis", ...params },
      query: "进行漏损因素智能分析",
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "water-system-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error("漏损分析失败");
    }
  }

  /**
   * 数据验证API接口
   */
  async validateData(params) {
    const requestData = {
      inputs: { query_type: "data_validation", ...params },
      query: `验证${params.field}数据的有效性`,
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "water-system-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error("数据验证失败");
    }
  }

  /**
   * 统计报表生成API接口
   */
  async generateStatistics(params) {
    const requestData = {
      inputs: { query_type: "statistics_report", ...params },
      query: `生成${params.reportType}水务统计报告`,
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "water-system-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error("统计报告生成失败");
    }
  }
}
