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
        let additionalData = null;

        // 水务管理功能检测
        if (this.isAssetLocationQuery(message)) {
          const response = this.getMockAssetLocationResponse(message);
          content = response.content;
          geoJson = response.geoJson;
          additionalData = response.additionalData;
        } else if (this.isAssetLifecycleQuery(message)) {
          const response = this.getMockAssetLifecycleResponse(message);
          content = response.content;
          geoJson = response.geoJson;
          additionalData = response.additionalData;
        } else if (this.isLeakAnalysisQuery(message)) {
          const response = this.getMockLeakAnalysisResponse(message);
          content = response.content;
          geoJson = response.geoJson;
          additionalData = response.additionalData;
        } else if (this.isDataValidationQuery(message)) {
          const response = this.getMockDataValidationResponse(message);
          content = response.content;
          additionalData = response.additionalData;
        } else if (this.isStatisticsQuery(message)) {
          const response = this.getMockStatisticsResponse(message);
          content = response.content;
          additionalData = response.additionalData;
        } else if (message.includes('北京') || message.includes('beijing')) {
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
          content = '我理解您想在地图上查看地理信息。请告诉我具体的地名，比如*"北京"*、*"上海"*等，我会为您在地图上显示相应的地理数据。\n\n**水务管理功能**:\n- 资产定位：如"显示湾仔区的PVC淡水管线"\n- 生命周期管理：如"显示服役超过30年的铸铁阀门"\n- 漏损分析：如"分析近期漏损事故原因"\n- 数据验证：如"检查管道直径数据"\n- 统计报表：如"生成月度水管维护报告"\n\n**基础功能**:\n- 显示城市边界\n- 标记位置点\n- 查看区域信息';
        }

        resolve({ content, geoJson, additionalData });
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

  // ========== 水务管理功能检测方法 ==========

  /**
   * 检测是否为资产定位查询
   */
  isAssetLocationQuery(message) {
    const keywords = ['显示', '查找', '定位', '管线', '阀门', '水表', '泵站', 'PVC', '铸铁', '淡水', '污水'];
    return keywords.some(keyword => message.includes(keyword)) && 
           (message.includes('区') || message.includes('路') || message.includes('街'));
  }

  /**
   * 检测是否为资产生命周期查询
   */
  isAssetLifecycleQuery(message) {
    const keywords = ['服役', '年', '老化', '使用', '安装', '维护', '更换', '生命周期'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * 检测是否为漏损分析查询
   */
  isLeakAnalysisQuery(message) {
    const keywords = ['漏损', '泄漏', '漏水', '爆管', '分析', '原因', '事故'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * 检测是否为数据验证查询
   */
  isDataValidationQuery(message) {
    const keywords = ['检查', '验证', '数据', '值域', '范围', '正确', '错误'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * 检测是否为统计查询
   */
  isStatisticsQuery(message) {
    const keywords = ['统计', '报表', '报告', '图表', '分析', '汇总', '月度', '年度'];
    return keywords.some(keyword => message.includes(keyword));
  }

  // ========== 水务管理模拟响应方法 ==========

  /**
   * 生成资产定位模拟响应
   */
  getMockAssetLocationResponse(message) {
    let area = '湾仔区';
    let material = 'PVC';
    let assetType = '淡水管线';
    
    // 简单解析区域、材质、资产类型
    if (message.includes('中环')) area = '中环区';
    if (message.includes('铸铁')) material = '铸铁';
    if (message.includes('阀门')) assetType = '阀门';
    if (message.includes('水表')) assetType = '水表';

    const content = `已为您定位**${area}**的**${material}${assetType}**:\n\n**检索结果**:\n- 找到 ${Math.floor(Math.random() * 50 + 10)} 条${assetType}记录\n- 材质: ${material}\n- 区域: ${area}\n\n**地图标注**: 已在地图上高亮显示相关设施`;

    const geoJson = this.generateWaterAssetGeoJson(area, assetType, material);
    
    const additionalData = {
      type: 'assetLocation',
      searchParams: { area, material, assetType },
      resultCount: Math.floor(Math.random() * 50 + 10)
    };

    return { content, geoJson, additionalData };
  }

  /**
   * 生成资产生命周期模拟响应
   */
  getMockAssetLifecycleResponse(message) {
    const years = message.match(/(\d+)年/)?.[1] || '30';
    const assetType = message.includes('阀门') ? '阀门' : '管线';
    const material = message.includes('铸铁') ? '铸铁' : 'PVC';

    const content = `**资产生命周期分析**:\n\n**筛选条件**: 服役超过${years}年的${material}${assetType}\n\n**分析结果**:\n- 符合条件的设施: ${Math.floor(Math.random() * 30 + 5)} 个\n- 平均服役年限: ${parseInt(years) + Math.floor(Math.random() * 10)} 年\n- 建议维护: ${Math.floor(Math.random() * 15 + 3)} 个\n- 建议更换: ${Math.floor(Math.random() * 8 + 1)} 个\n\n**风险评估**: 部分设施接近使用寿命，建议制定维护计划`;

    const geoJson = this.generateLifecycleAssetGeoJson(years, assetType, material);
    
    const additionalData = {
      type: 'assetLifecycle',
      criteria: { years, assetType, material },
      analysis: {
        totalCount: Math.floor(Math.random() * 30 + 5),
        maintenanceNeeded: Math.floor(Math.random() * 15 + 3),
        replacementNeeded: Math.floor(Math.random() * 8 + 1)
      }
    };

    return { content, geoJson, additionalData };
  }

  /**
   * 生成漏损分析模拟响应
   */
  getMockLeakAnalysisResponse(message) {
    const content = `**漏损智能分析报告**:\n\n**时间范围**: 近30天\n**漏损事件**: ${Math.floor(Math.random() * 15 + 5)} 起\n\n**材质分析**:\n- 铸铁管线: 占比 ${Math.floor(Math.random() * 30 + 40)}%\n- PVC管线: 占比 ${Math.floor(Math.random() * 20 + 30)}%\n- 其他材质: 占比 ${Math.floor(Math.random() * 15 + 10)}%\n\n**服役年限分析**:\n- 30年以上: ${Math.floor(Math.random() * 20 + 50)}%\n- 20-30年: ${Math.floor(Math.random() * 15 + 25)}%\n- 20年以下: ${Math.floor(Math.random() * 10 + 15)}%\n\n**建议**: 重点关注服役超过30年的铸铁管线`;

    const geoJson = this.generateLeakAnalysisGeoJson();
    
    const additionalData = {
      type: 'leakAnalysis',
      summary: {
        totalLeaks: Math.floor(Math.random() * 15 + 5),
        materialDistribution: {
          iron: Math.floor(Math.random() * 30 + 40),
          pvc: Math.floor(Math.random() * 20 + 30),
          other: Math.floor(Math.random() * 15 + 10)
        },
        ageDistribution: {
          over30: Math.floor(Math.random() * 20 + 50),
          between20to30: Math.floor(Math.random() * 15 + 25),
          under20: Math.floor(Math.random() * 10 + 15)
        }
      }
    };

    return { content, geoJson, additionalData };
  }

  /**
   * 生成数据验证模拟响应
   */
  getMockDataValidationResponse(message) {
    const fieldType = message.includes('直径') ? '管道直径' : 
                     message.includes('压力') ? '水压' : 
                     message.includes('流量') ? '流量' : '数据字段';

    const content = `**数据验证结果**:\n\n**验证字段**: ${fieldType}\n\n**值域信息**:\n- 最小值: ${Math.floor(Math.random() * 50 + 10)}\n- 最大值: ${Math.floor(Math.random() * 500 + 200)}\n- 单位: ${fieldType.includes('直径') ? 'mm' : fieldType.includes('压力') ? 'MPa' : fieldType.includes('流量') ? 'L/s' : '标准单位'}\n\n**验证状态**: ✅ 数据格式正确\n**异常记录**: ${Math.floor(Math.random() * 5)} 条数据需要修正`;

    const additionalData = {
      type: 'dataValidation',
      field: fieldType,
      validation: {
        minValue: Math.floor(Math.random() * 50 + 10),
        maxValue: Math.floor(Math.random() * 500 + 200),
        unit: fieldType.includes('直径') ? 'mm' : fieldType.includes('压力') ? 'MPa' : fieldType.includes('流量') ? 'L/s' : '标准单位',
        anomalies: Math.floor(Math.random() * 5)
      }
    };

    return { content, geoJson: null, additionalData };
  }

  /**
   * 生成统计报表模拟响应
   */
  getMockStatisticsResponse(message) {
    const reportType = message.includes('月度') ? '月度' : 
                      message.includes('年度') ? '年度' : 
                      message.includes('季度') ? '季度' : '综合';

    const content = `**${reportType}水务统计报告**:\n\n**报告概览**:\n- 管线总长度: ${(Math.random() * 500 + 1000).toFixed(1)} km\n- 阀门总数: ${Math.floor(Math.random() * 5000 + 10000)} 个\n- 服务人口: ${(Math.random() * 50 + 100).toFixed(1)} 万人\n\n**运行状态**:\n- 正常运行: ${Math.floor(Math.random() * 10 + 85)}%\n- 需要维护: ${Math.floor(Math.random() * 8 + 10)}%\n- 故障停运: ${Math.floor(Math.random() * 3 + 2)}%\n\n**专业建议**:\n- 建议加强老旧管网巡检\n- 优化阀门维护周期\n- 关注季节性用水高峰`;

    const additionalData = {
      type: 'statisticsReport',
      reportType,
      statistics: {
        totalPipeLength: (Math.random() * 500 + 1000).toFixed(1),
        totalValves: Math.floor(Math.random() * 5000 + 10000),
        servicePopulation: (Math.random() * 50 + 100).toFixed(1),
        operationalStatus: {
          normal: Math.floor(Math.random() * 10 + 85),
          maintenance: Math.floor(Math.random() * 8 + 10),
          failure: Math.floor(Math.random() * 3 + 2)
        },
        charts: this.generateMockChartData()
      }
    };

    return { content, geoJson: null, additionalData };
  }

  // ========== 水务专用GeoJSON生成方法 ==========

  /**
   * 生成水务资产GeoJSON数据
   */
  generateWaterAssetGeoJson(area, assetType, material) {
    const features = [];
    const baseCoord = [114.15, 22.28]; // 香港坐标
    const count = Math.floor(Math.random() * 10 + 5);

    for (let i = 0; i < count; i++) {
      features.push({
        type: 'Feature',
        properties: {
          name: `${material}${assetType} ${i + 1}`,
          area: area,
          material: material,
          assetType: assetType,
          id: `asset_${i + 1}`,
          status: Math.random() > 0.8 ? '维护中' : '正常'
        },
        geometry: {
          type: assetType.includes('管线') ? 'LineString' : 'Point',
          coordinates: assetType.includes('管线') ? [
            [baseCoord[0] + (Math.random() - 0.5) * 0.01, baseCoord[1] + (Math.random() - 0.5) * 0.01],
            [baseCoord[0] + (Math.random() - 0.5) * 0.01, baseCoord[1] + (Math.random() - 0.5) * 0.01]
          ] : [baseCoord[0] + (Math.random() - 0.5) * 0.02, baseCoord[1] + (Math.random() - 0.5) * 0.02]
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * 生成生命周期分析GeoJSON数据
   */
  generateLifecycleAssetGeoJson(years, assetType, material) {
    const features = [];
    const baseCoord = [114.15, 22.28];
    const count = Math.floor(Math.random() * 15 + 8);

    for (let i = 0; i < count; i++) {
      const age = parseInt(years) + Math.floor(Math.random() * 15);
      features.push({
        type: 'Feature',
        properties: {
          name: `${material}${assetType} ${i + 1}`,
          material: material,
          assetType: assetType,
          age: age,
          installYear: new Date().getFullYear() - age,
          riskLevel: age > parseInt(years) + 10 ? '高' : age > parseInt(years) + 5 ? '中' : '低',
          id: `lifecycle_${i + 1}`
        },
        geometry: {
          type: 'Point',
          coordinates: [baseCoord[0] + (Math.random() - 0.5) * 0.03, baseCoord[1] + (Math.random() - 0.5) * 0.03]
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * 生成漏损分析GeoJSON数据
   */
  generateLeakAnalysisGeoJson() {
    const features = [];
    const baseCoord = [114.15, 22.28];
    const count = Math.floor(Math.random() * 8 + 3);

    for (let i = 0; i < count; i++) {
      const materials = ['铸铁', 'PVC', '不锈钢'];
      const material = materials[Math.floor(Math.random() * materials.length)];
      const severity = ['轻微', '中等', '严重'][Math.floor(Math.random() * 3)];
      
      features.push({
        type: 'Feature',
        properties: {
          name: `漏损点 ${i + 1}`,
          material: material,
          severity: severity,
          leakDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          repairStatus: Math.random() > 0.6 ? '已修复' : '待修复',
          id: `leak_${i + 1}`
        },
        geometry: {
          type: 'Point',
          coordinates: [baseCoord[0] + (Math.random() - 0.5) * 0.025, baseCoord[1] + (Math.random() - 0.5) * 0.025]
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * 生成模拟图表数据
   */
  generateMockChartData() {
    return {
      materialDistribution: {
        labels: ['PVC', '铸铁', '不锈钢', '其他'],
        data: [45, 30, 15, 10]
      },
      ageDistribution: {
        labels: ['0-10年', '10-20年', '20-30年', '30年以上'],
        data: [25, 35, 25, 15]
      },
      monthlyMaintenance: {
        labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
        data: [12, 19, 8, 15, 22, 18]
      }
    };
  }

  // ========== 新增的API接口方法（为后端对接准备） ==========

  /**
   * 资产定位API接口
   * @param {Object} params - 查询参数 {area, material, assetType}
   * @returns {Promise} API响应
   */
  async queryAssetLocation(params) {
    if (this.apiKey === 'your-dify-api-key') {
      // 模拟模式
      return this.getMockAssetLocationResponse(`显示${params.area}的${params.material}${params.assetType}`);
    }
    
    // 实际API调用
    const requestData = {
      inputs: { query_type: 'asset_location', ...params },
      query: `查询${params.area}的${params.material}${params.assetType}`,
      response_mode: 'blocking',
      conversation_id: this.conversationId || '',
      user: 'water-system-user'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error('资产定位查询失败');
    }
  }

  /**
   * 资产生命周期分析API接口
   */
  async queryAssetLifecycle(params) {
    if (this.apiKey === 'your-dify-api-key') {
      return this.getMockAssetLifecycleResponse(`显示服役超过${params.years}年的${params.material}${params.assetType}`);
    }
    
    const requestData = {
      inputs: { query_type: 'asset_lifecycle', ...params },
      query: `分析服役超过${params.years}年的${params.assetType}`,
      response_mode: 'blocking',
      conversation_id: this.conversationId || '',
      user: 'water-system-user'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error('生命周期分析失败');
    }
  }

  /**
   * 漏损分析API接口
   */
  async queryLeakAnalysis(params = {}) {
    if (this.apiKey === 'your-dify-api-key') {
      return this.getMockLeakAnalysisResponse('分析近期漏损事故原因');
    }
    
    const requestData = {
      inputs: { query_type: 'leak_analysis', ...params },
      query: '进行漏损因素智能分析',
      response_mode: 'blocking',
      conversation_id: this.conversationId || '',
      user: 'water-system-user'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error('漏损分析失败');
    }
  }

  /**
   * 数据验证API接口
   */
  async validateData(params) {
    if (this.apiKey === 'your-dify-api-key') {
      return this.getMockDataValidationResponse(`检查${params.field}数据`);
    }
    
    const requestData = {
      inputs: { query_type: 'data_validation', ...params },
      query: `验证${params.field}数据的有效性`,
      response_mode: 'blocking',
      conversation_id: this.conversationId || '',
      user: 'water-system-user'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error('数据验证失败');
    }
  }

  /**
   * 统计报表生成API接口
   */
  async generateStatistics(params) {
    if (this.apiKey === 'your-dify-api-key') {
      return this.getMockStatisticsResponse(`生成${params.reportType}统计报告`);
    }
    
    const requestData = {
      inputs: { query_type: 'statistics_report', ...params },
      query: `生成${params.reportType}水务统计报告`,
      response_mode: 'blocking',
      conversation_id: this.conversationId || '',
      user: 'water-system-user'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseWorkflowResponse(response.data);
    } catch (error) {
      throw new Error('统计报告生成失败');
    }
  }

  /**
   * 解析工作流响应数据
   */
  parseWorkflowResponse(responseData) {
    return {
      content: responseData.data?.outputs?.content || '处理完成',
      geoJson: responseData.data?.outputs?.geojson || null,
      additionalData: responseData.data?.outputs?.additional_data || null
    };
  }
}