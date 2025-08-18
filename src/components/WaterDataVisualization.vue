<!--
  水务数据可视化组件
  用于展示AI分析返回的额外数据，如统计图表、验证结果等
-->
<template>
  <div class="water-data-visualization">
    <!-- 资产定位结果 -->
    <div v-if="data.type === 'assetLocation'" class="asset-location-data">
      <div class="data-header">
        <h4>🔍 资产定位结果</h4>
      </div>
      <div class="search-params">
        <span class="param-tag">区域: {{ data.searchParams.area }}</span>
        <span class="param-tag">材质: {{ data.searchParams.material }}</span>
        <span class="param-tag">类型: {{ data.searchParams.assetType }}</span>
      </div>
      <div class="result-count">
        找到 <strong>{{ data.resultCount }}</strong> 条记录
      </div>
    </div>

    <!-- 资产生命周期分析 -->
    <div v-if="data.type === 'assetLifecycle'" class="asset-lifecycle-data">
      <div class="data-header">
        <h4>📊 生命周期分析</h4>
      </div>
      <div class="lifecycle-stats">
        <div class="stat-item">
          <span class="stat-label">总计:</span>
          <span class="stat-value">{{ data.analysis.totalCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">需维护:</span>
          <span class="stat-value warning">{{ data.analysis.maintenanceNeeded }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">需更换:</span>
          <span class="stat-value danger">{{ data.analysis.replacementNeeded }}</span>
        </div>
      </div>
    </div>

    <!-- 漏损分析结果 -->
    <div v-if="data.type === 'leakAnalysis'" class="leak-analysis-data">
      <div class="data-header">
        <h4>🚨 漏损分析</h4>
      </div>
      <div class="analysis-charts">
        <div class="chart-section">
          <h5>材质分布</h5>
          <div class="mini-chart">
            <div class="chart-bar">
              <div class="bar-item" 
                   v-for="(value, key) in data.summary.materialDistribution" 
                   :key="key"
                   :style="{ width: value + '%' }"
                   :class="getBarClass(key)">
                <span class="bar-label">{{ getMaterialLabel(key) }}: {{ value }}%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="chart-section">
          <h5>服役年限分布</h5>
          <div class="mini-chart">
            <div class="chart-bar">
              <div class="bar-item"
                   v-for="(value, key) in data.summary.ageDistribution"
                   :key="key"
                   :style="{ width: value + '%' }"
                   :class="getAgeBarClass(key)">
                <span class="bar-label">{{ getAgeLabel(key) }}: {{ value }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据验证结果 -->
    <div v-if="data.type === 'dataValidation'" class="data-validation-result">
      <div class="data-header">
        <h4>✅ 数据验证</h4>
      </div>
      <div class="validation-details">
        <div class="validation-item">
          <span class="label">字段:</span>
          <span class="value">{{ data.field }}</span>
        </div>
        <div class="validation-item">
          <span class="label">值域:</span>
          <span class="value">{{ data.validation.minValue }} - {{ data.validation.maxValue }} {{ data.validation.unit }}</span>
        </div>
        <div class="validation-item">
          <span class="label">异常:</span>
          <span class="value" :class="data.validation.anomalies > 0 ? 'warning' : 'success'">
            {{ data.validation.anomalies }} 条记录
          </span>
        </div>
      </div>
    </div>

    <!-- 统计报表结果 -->
    <div v-if="data.type === 'statisticsReport'" class="statistics-report-data">
      <div class="data-header">
        <h4>📈 统计报表</h4>
      </div>
      <div class="report-summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-value">{{ data.statistics.totalPipeLength }} km</div>
            <div class="summary-label">管线总长</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">{{ data.statistics.totalValves }}</div>
            <div class="summary-label">阀门总数</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">{{ data.statistics.servicePopulation }} 万</div>
            <div class="summary-label">服务人口</div>
          </div>
        </div>
        <div class="status-chart">
          <h5>运行状态分布</h5>
          <div class="status-bars">
            <div class="status-bar">
              <span class="status-label">正常运行</span>
              <div class="status-progress">
                <div class="progress-fill success" 
                     :style="{ width: data.statistics.operationalStatus.normal + '%' }">
                  {{ data.statistics.operationalStatus.normal }}%
                </div>
              </div>
            </div>
            <div class="status-bar">
              <span class="status-label">需要维护</span>
              <div class="status-progress">
                <div class="progress-fill warning" 
                     :style="{ width: data.statistics.operationalStatus.maintenance + '%' }">
                  {{ data.statistics.operationalStatus.maintenance }}%
                </div>
              </div>
            </div>
            <div class="status-bar">
              <span class="status-label">故障停运</span>
              <div class="status-progress">
                <div class="progress-fill danger" 
                     :style="{ width: data.statistics.operationalStatus.failure + '%' }">
                  {{ data.statistics.operationalStatus.failure }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
// 组件属性
interface Props {
  data: any;
}

const props = defineProps<Props>();

// 工具方法
const getMaterialLabel = (key: string): string => {
  const labels: { [key: string]: string } = {
    iron: '铸铁',
    pvc: 'PVC',
    other: '其他'
  };
  return labels[key] || key;
};

const getAgeLabel = (key: string): string => {
  const labels: { [key: string]: string } = {
    over30: '30年以上',
    between20to30: '20-30年',
    under20: '20年以下'
  };
  return labels[key] || key;
};

const getBarClass = (key: string): string => {
  const classes: { [key: string]: string } = {
    iron: 'bar-warning',
    pvc: 'bar-success',
    other: 'bar-info'
  };
  return classes[key] || 'bar-default';
};

const getAgeBarClass = (key: string): string => {
  const classes: { [key: string]: string } = {
    over30: 'bar-danger',
    between20to30: 'bar-warning',
    under20: 'bar-success'
  };
  return classes[key] || 'bar-default';
};
</script>

<style scoped>
.water-data-visualization {
  margin-top: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border: 1px solid rgba(0, 123, 255, 0.1);
}

.data-header {
  margin-bottom: 12px;
}

.data-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

/* 资产定位样式 */
.search-params {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.param-tag {
  background: #667eea;
  color: white;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 12px;
}

.result-count {
  color: #495057;
  font-size: 14px;
}

/* 生命周期分析样式 */
.lifecycle-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  min-width: 80px;
}

.stat-label {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #2c3e50;
}

.stat-value.warning {
  color: #f39c12;
}

.stat-value.danger {
  color: #e74c3c;
}

/* 漏损分析样式 */
.analysis-charts {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-section h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #495057;
}

.mini-chart {
  background: white;
  padding: 12px;
  border-radius: 8px;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-item {
  height: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 60px;
  transition: all 0.3s ease;
}

.bar-item.bar-success {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
}

.bar-item.bar-warning {
  background: linear-gradient(135deg, #f39c12, #e67e22);
}

.bar-item.bar-danger {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.bar-item.bar-info {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

.bar-item.bar-default {
  background: linear-gradient(135deg, #95a5a6, #7f8c8d);
}

.bar-label {
  color: white;
  font-size: 11px;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 数据验证样式 */
.validation-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
}

.validation-item .label {
  font-weight: 600;
  color: #495057;
}

.validation-item .value {
  color: #2c3e50;
}

.validation-item .value.success {
  color: #27ae60;
}

.validation-item .value.warning {
  color: #f39c12;
}

/* 统计报表样式 */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.summary-value {
  font-size: 20px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 4px;
}

.summary-label {
  font-size: 12px;
  color: #6c757d;
}

.status-chart h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #495057;
}

.status-bars {
  background: white;
  padding: 12px;
  border-radius: 8px;
}

.status-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}

.status-bar:last-child {
  margin-bottom: 0;
}

.status-label {
  min-width: 80px;
  font-size: 12px;
  color: #495057;
}

.status-progress {
  flex: 1;
  height: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 600;
  transition: width 0.5s ease;
}

.progress-fill.success {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
}

.progress-fill.warning {
  background: linear-gradient(135deg, #f39c12, #e67e22);
}

.progress-fill.danger {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .lifecycle-stats {
    justify-content: center;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .status-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .status-label {
    min-width: auto;
    text-align: center;
  }
}
</style>