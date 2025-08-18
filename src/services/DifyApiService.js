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
  apiKey;
  conversationId = null;

  constructor() {
    // 从环境变量或配置中获取Dify API设置
    // 在实际部署时需要配置正确的Dify API端点和密钥
    this.baseUrl = "http://127.0.0.1:580/v1";
    this.apiKey = "app-d86VpODIGUAafLAWyKtBpGmX";
  }

  /**
   * 发送消息到Dify AI (SSE streaming)
   * 以流式获取回答，实时回调增量，再组装完整结果做后处理
   * @param {string} message
   * @param {Object} opts
   * @param {function(string):void} opts.onToken  每个增量token回调
   * @param {function(Object):void} opts.onEvent  原始事件回调 (eventObj)
   * @param {AbortSignal} opts.signal  可选中断
   * @returns {Promise<{content:string, geoJson:Object|null, additionalData?:any}>}
   */
  async sendMessage(message, opts = {}) {
    const { onEvent, signal } = opts;
    // 改为调用 Workflow 应用 API (blocking 模式，不再解析SSE)
    const requestData = {
      inputs: { ms: message },
      response_mode: "blocking",
      conversation_id: this.conversationId || "",
      user: "map-user",
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/run`,
        requestData,
        {
          signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response?.data) throw new Error("AI服务返回空数据");
      if (onEvent) onEvent({ type: "workflow_raw", data: response.data });

      // 解析标准工作流结构
      const content = response.data.data?.outputs?.data;

      const parsed = this._safeParseJson(content);
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed != null
        ? [parsed]
        : [];

      // 解析 content 数组中的 geom 字段并组装为 FeatureCollection
      let geoJson = [];
      for (const item of arr) {
        const geom = item.geom;
        geoJson.push(this._safeParseJson(geom));
      }
      console.log("AI解析后的数组:", geoJson);

      return {
        content: content || "（无内容）",
        geoJson,
      };
    } catch (err) {
      if (signal?.aborted) throw new Error("已取消");
      throw new Error(err?.message || "AI服务调用失败");
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
