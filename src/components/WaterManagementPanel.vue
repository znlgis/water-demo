<!--
  水务管理控制面板
  提供快速访问水务管理功能的用户界面
-->
<template>
  <div class="water-management-panel" v-if="visible">
    <div class="panel-container">
      <!-- 面板头部 -->
      <div class="panel-header">
        <h3>💧 水务管理控制台</h3>
        <button class="close-button" @click="closePanel" title="关闭">×</button>
      </div>

      <!-- 功能选项卡 -->
      <div class="tab-container">
        <div class="tab-buttons">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
          >
            {{ tab.icon }} {{ tab.label }}
          </button>
        </div>

        <!-- 选项卡内容 -->
        <div class="tab-content">
          <!-- 资产定位 -->
          <div v-if="activeTab === 'assetLocation'" class="tab-panel">
            <div class="feature-description">
              <h4>🔍 快速资产定位与可视化</h4>
              <p>通过AI解析查询条件，快速定位并在地图上显示水务资产</p>
            </div>
            <div class="quick-actions">
              <h5>快速查询</h5>
              <div class="action-buttons">
                <button @click="queryAssets('湾仔区', 'PVC', '淡水管线')" class="action-btn">
                  湾仔区PVC淡水管线
                </button>
                <button @click="queryAssets('中环区', '铸铁', '阀门')" class="action-btn">
                  中环区铸铁阀门
                </button>
                <button @click="queryAssets('九龙', 'PVC', '水表')" class="action-btn">
                  九龙PVC水表
                </button>
              </div>
            </div>
            <div class="custom-query">
              <h5>自定义查询</h5>
              <div class="query-form">
                <select v-model="assetQuery.area" class="form-select">
                  <option value="">选择区域</option>
                  <option value="湾仔区">湾仔区</option>
                  <option value="中环区">中环区</option>
                  <option value="九龙">九龙</option>
                  <option value="新界">新界</option>
                </select>
                <select v-model="assetQuery.material" class="form-select">
                  <option value="">选择材质</option>
                  <option value="PVC">PVC</option>
                  <option value="铸铁">铸铁</option>
                  <option value="不锈钢">不锈钢</option>
                  <option value="钢管">钢管</option>
                </select>
                <select v-model="assetQuery.assetType" class="form-select">
                  <option value="">选择类型</option>
                  <option value="淡水管线">淡水管线</option>
                  <option value="污水管线">污水管线</option>
                  <option value="阀门">阀门</option>
                  <option value="水表">水表</option>
                  <option value="泵站">泵站</option>
                </select>
                <button @click="executeAssetQuery" :disabled="!canExecuteAssetQuery" class="query-btn">
                  查询资产
                </button>
              </div>
            </div>
          </div>

          <!-- 生命周期管理 -->
          <div v-if="activeTab === 'lifecycle'" class="tab-panel">
            <div class="feature-description">
              <h4>📊 资产生命周期辅助管理</h4>
              <p>基于服役年限分析资产状态，制定维护和更换计划</p>
            </div>
            <div class="lifecycle-controls">
              <div class="control-group">
                <label>服役年限（年）:</label>
                <input 
                  v-model.number="lifecycleQuery.years" 
                  type="number" 
                  min="1" 
                  max="100" 
                  class="form-input"
                >
              </div>
              <div class="control-group">
                <label>资产类型:</label>
                <select v-model="lifecycleQuery.assetType" class="form-select">
                  <option value="阀门">阀门</option>
                  <option value="管线">管线</option>
                  <option value="水表">水表</option>
                  <option value="泵站">泵站</option>
                </select>
              </div>
              <div class="control-group">
                <label>材质:</label>
                <select v-model="lifecycleQuery.material" class="form-select">
                  <option value="铸铁">铸铁</option>
                  <option value="PVC">PVC</option>
                  <option value="不锈钢">不锈钢</option>
                  <option value="钢管">钢管</option>
                </select>
              </div>
              <button @click="executeLifecycleQuery" class="query-btn">
                生命周期分析
              </button>
            </div>
            <div class="quick-lifecycle-actions">
              <h5>常用分析</h5>
              <div class="action-buttons">
                <button @click="queryLifecycle(30, '铸铁', '阀门')" class="action-btn">
                  30年以上铸铁阀门
                </button>
                <button @click="queryLifecycle(25, 'PVC', '管线')" class="action-btn">
                  25年以上PVC管线
                </button>
                <button @click="queryLifecycle(20, '铸铁', '管线')" class="action-btn">
                  20年以上铸铁管线
                </button>
              </div>
            </div>
          </div>

          <!-- 漏损分析 -->
          <div v-if="activeTab === 'leakAnalysis'" class="tab-panel">
            <div class="feature-description">
              <h4>🚨 漏损因素智能分析</h4>
              <p>分析漏损事故与管线材质、服役时间的相关性</p>
            </div>
            <div class="analysis-controls">
              <div class="control-group">
                <label>分析时间范围:</label>
                <select v-model="leakQuery.timeRange" class="form-select">
                  <option value="7">最近7天</option>
                  <option value="30">最近30天</option>
                  <option value="90">最近3个月</option>
                  <option value="365">最近1年</option>
                </select>
              </div>
              <div class="control-group">
                <label>分析区域:</label>
                <select v-model="leakQuery.area" class="form-select">
                  <option value="">全部区域</option>
                  <option value="湾仔区">湾仔区</option>
                  <option value="中环区">中环区</option>
                  <option value="九龙">九龙</option>
                  <option value="新界">新界</option>
                </select>
              </div>
              <button @click="executeLeakAnalysis" class="query-btn">
                开始分析
              </button>
            </div>
            <div class="analysis-reports">
              <h5>预设分析报告</h5>
              <div class="action-buttons">
                <button @click="generateLeakReport('material')" class="action-btn">
                  材质相关性分析
                </button>
                <button @click="generateLeakReport('age')" class="action-btn">
                  年限相关性分析
                </button>
                <button @click="generateLeakReport('seasonal')" class="action-btn">
                  季节性分析
                </button>
              </div>
            </div>
          </div>

          <!-- 数据验证 -->
          <div v-if="activeTab === 'dataValidation'" class="tab-panel">
            <div class="feature-description">
              <h4>✅ 数据编辑智能辅助</h4>
              <p>验证数据输入的有效性，提供值域检查和纠错建议</p>
            </div>
            <div class="validation-controls">
              <div class="control-group">
                <label>验证字段:</label>
                <select v-model="validationQuery.field" class="form-select">
                  <option value="管道直径">管道直径</option>
                  <option value="水压">水压</option>
                  <option value="流量">流量</option>
                  <option value="水质指标">水质指标</option>
                  <option value="温度">温度</option>
                </select>
              </div>
              <div class="control-group">
                <label>输入值:</label>
                <input 
                  v-model="validationQuery.value" 
                  type="text" 
                  placeholder="请输入要验证的数据值"
                  class="form-input"
                >
              </div>
              <button @click="executeDataValidation" :disabled="!validationQuery.field || !validationQuery.value" class="query-btn">
                验证数据
              </button>
            </div>
            <div class="validation-examples">
              <h5>常见验证场景</h5>
              <div class="action-buttons">
                <button @click="validateExample('管道直径', '850')" class="action-btn">
                  验证管道直径
                </button>
                <button @click="validateExample('水压', '0.8')" class="action-btn">
                  验证水压数据
                </button>
                <button @click="validateExample('流量', '125')" class="action-btn">
                  验证流量数据
                </button>
              </div>
            </div>
          </div>

          <!-- 统计报表 -->
          <div v-if="activeTab === 'statistics'" class="tab-panel">
            <div class="feature-description">
              <h4>📈 智能统计与报表生成</h4>
              <p>生成专业的水务统计报告和可视化图表</p>
            </div>
            <div class="report-controls">
              <div class="control-group">
                <label>报表类型:</label>
                <select v-model="statisticsQuery.reportType" class="form-select">
                  <option value="月度">月度报表</option>
                  <option value="季度">季度报表</option>
                  <option value="年度">年度报表</option>
                  <option value="综合">综合分析</option>
                </select>
              </div>
              <div class="control-group">
                <label>统计范围:</label>
                <select v-model="statisticsQuery.scope" class="form-select">
                  <option value="全市">全市</option>
                  <option value="湾仔区">湾仔区</option>
                  <option value="中环区">中环区</option>
                  <option value="九龙">九龙</option>
                  <option value="新界">新界</option>
                </select>
              </div>
              <button @click="executeStatisticsQuery" class="query-btn">
                生成报表
              </button>
            </div>
            <div class="report-templates">
              <h5>报表模板</h5>
              <div class="action-buttons">
                <button @click="generateReport('maintenance')" class="action-btn">
                  维护情况报告
                </button>
                <button @click="generateReport('performance')" class="action-btn">
                  运行性能报告
                </button>
                <button @click="generateReport('assets')" class="action-btn">
                  资产统计报告
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import DifyApiService from '../services/DifyApiService';

// 组件属性
interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

// 事件定义
const emit = defineEmits<{
  close: [];
  queryExecuted: [result: any];
}>();

// Dify API服务实例
const difyService = new DifyApiService();

// 响应式数据
const activeTab = ref('assetLocation');

// 选项卡配置
const tabs = ref([
  { id: 'assetLocation', label: '资产定位', icon: '🔍' },
  { id: 'lifecycle', label: '生命周期', icon: '📊' },
  { id: 'leakAnalysis', label: '漏损分析', icon: '🚨' },
  { id: 'dataValidation', label: '数据验证', icon: '✅' },
  { id: 'statistics', label: '统计报表', icon: '📈' }
]);

// 查询参数
const assetQuery = ref({
  area: '',
  material: '',
  assetType: ''
});

const lifecycleQuery = ref({
  years: 30,
  assetType: '阀门',
  material: '铸铁'
});

const leakQuery = ref({
  timeRange: '30',
  area: ''
});

const validationQuery = ref({
  field: '',
  value: ''
});

const statisticsQuery = ref({
  reportType: '月度',
  scope: '全市'
});

// 计算属性
const canExecuteAssetQuery = computed(() => {
  return assetQuery.value.area && assetQuery.value.material && assetQuery.value.assetType;
});

// 方法定义
const closePanel = () => {
  emit('close');
};

// 资产定位相关方法
const queryAssets = async (area: string, material: string, assetType: string) => {
  try {
    const result = await difyService.queryAssetLocation({ area, material, assetType });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('资产查询失败:', error);
  }
};

const executeAssetQuery = async () => {
  if (!canExecuteAssetQuery.value) return;
  await queryAssets(assetQuery.value.area, assetQuery.value.material, assetQuery.value.assetType);
};

// 生命周期相关方法
const queryLifecycle = async (years: number, material: string, assetType: string) => {
  try {
    const result = await difyService.queryAssetLifecycle({ years, material, assetType });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('生命周期查询失败:', error);
  }
};

const executeLifecycleQuery = async () => {
  await queryLifecycle(lifecycleQuery.value.years, lifecycleQuery.value.material, lifecycleQuery.value.assetType);
};

// 漏损分析相关方法
const executeLeakAnalysis = async () => {
  try {
    const result = await difyService.queryLeakAnalysis({ 
      timeRange: leakQuery.value.timeRange,
      area: leakQuery.value.area 
    });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('漏损分析失败:', error);
  }
};

const generateLeakReport = async (reportType: string) => {
  try {
    const result = await difyService.queryLeakAnalysis({ reportType });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('生成漏损报告失败:', error);
  }
};

// 数据验证相关方法
const executeDataValidation = async () => {
  try {
    const result = await difyService.validateData({
      field: validationQuery.value.field,
      value: validationQuery.value.value
    });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('数据验证失败:', error);
  }
};

const validateExample = async (field: string, value: string) => {
  validationQuery.value.field = field;
  validationQuery.value.value = value;
  await executeDataValidation();
};

// 统计报表相关方法
const executeStatisticsQuery = async () => {
  try {
    const result = await difyService.generateStatistics({
      reportType: statisticsQuery.value.reportType,
      scope: statisticsQuery.value.scope
    });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('统计报表生成失败:', error);
  }
};

const generateReport = async (templateType: string) => {
  try {
    const result = await difyService.generateStatistics({
      reportType: templateType,
      scope: statisticsQuery.value.scope
    });
    emit('queryExecuted', result);
  } catch (error) {
    console.error('报表生成失败:', error);
  }
};
</script>

<style scoped>
.water-management-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.panel-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 900px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.panel-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  color: white;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tab-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  overflow-x: auto;
}

.tab-button {
  padding: 12px 20px;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  border-bottom: 3px solid transparent;
}

.tab-button:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #495057;
}

.tab-button.active {
  background: white;
  color: #667eea;
  border-bottom-color: #667eea;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.tab-panel {
  padding: 24px;
}

.feature-description {
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.feature-description h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.feature-description p {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
}

.quick-actions,
.custom-query,
.lifecycle-controls,
.analysis-controls,
.validation-controls,
.report-controls {
  margin-bottom: 24px;
}

.quick-actions h5,
.custom-query h5,
.quick-lifecycle-actions h5,
.analysis-reports h5,
.validation-examples h5,
.report-templates h5 {
  margin: 0 0 12px 0;
  color: #495057;
  font-size: 14px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.query-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 12px;
  align-items: end;
}

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
}

.form-select,
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.query-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  height: fit-content;
}

.query-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

.query-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .water-management-panel {
    padding: 10px;
  }
  
  .panel-container {
    max-height: 90vh;
  }
  
  .tab-buttons {
    flex-wrap: wrap;
  }
  
  .tab-button {
    flex: 1;
    min-width: 120px;
  }
  
  .query-form {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    justify-content: center;
  }
  
  .tab-panel {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .feature-description {
    padding: 12px;
  }
  
  .action-btn {
    padding: 6px 12px;
    font-size: 11px;
  }
  
  .form-select,
  .form-input {
    padding: 8px 10px;
    font-size: 13px;
  }
}
</style>