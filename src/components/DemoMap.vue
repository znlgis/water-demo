<!--
  OpenLayers地图演示组件
  功能：
  1. 展示基于OpenLayers的交互式地图
  2. 动态加载GeoServer图层和图层组
  3. 提供图层控制、缩放、上下文菜单等地图控件
-->
<template>
  <!-- OpenLayers地图容器 -->
  <Map.OlMap id="map" ref="mapRef" :controls="[]">
    <!-- 地图视图配置：中心点、投影、缩放级别 -->
    <Map.OlView
        ref="view"
        :center="center"
        :projection="projection"
        :zoom="zoom"
    />

    <!-- 动态图层组：通过GeoServer API获取的图层组 -->
    <Layers.OlLayerGroup v-for="group in dynamicLayerGroupList" :key="group.name" :title="group.name"
                         :visible="group.visible">
      <!-- 图层组内的瓦片图层 -->
      <Layers.OlTileLayer v-for="layer in group.layers" :key="layer.name" :title="layer.name" :visible="layer.visible">
        <Sources.OlSourceTileWms :layers="layer.name" :url="layer.url"/>
      </Layers.OlTileLayer>
    </Layers.OlLayerGroup>

    <!-- 动态图层：通过GeoServer API获取的单独图层 -->
    <Layers.OlTileLayer v-for="layer in dynamicLayerList" :key="layer.name" :title="layer.name"
                        :visible="layer.visible">
      <Sources.OlSourceTileWms :layers="layer.name" :url="layer.url"/>
    </Layers.OlTileLayer>

    <!-- 地图控件：图层切换器（展开状态） -->
    <MapControls.OlLayerswitcherControl :collapsed="false"/>

    <!-- 地图控件：缩放控制 -->
    <MapControls.OlZoomControl/>

    <!-- 地图控件：右键上下文菜单 -->
    <MapControls.OlContextMenuControl/>

    <!-- 地图控件：比例尺 -->
    <MapControls.OlScalelineControl/>

  </Map.OlMap>
  
  <!-- 控制按钮组 - AI优先设计，移除传统菜单 -->
  <!-- 移除了传统的水务管理按钮，所有功能通过AI对话实现 -->
  
  <!-- AI对话框组件 - 永远可见，位于地图底部中央 -->
  <AiChatDialog 
    :visible="true"
    @close="closeChatDialog"
    @geoJsonReceived="handleGeoJsonReceived"
    @clearLayers="clearGeoJsonLayers"
    @additionalDataReceived="handleAdditionalDataReceived"
  />
  
  <!-- 水务管理面板组件 - 保留用于整合功能，但不再直接显示 -->
  <WaterManagementPanel
    :visible="waterPanelVisible"
    @close="closeWaterPanel"
    @queryExecuted="handleWaterManagementQuery"
  />
</template>

<script lang="ts" setup>
//Vue组合式API函数
import {onMounted, ref} from "vue";
// 导入OpenLayers Map类型定义
import type MapRef from "ol/Map";
// 导入Vue3-OpenLayers组件
import {Layers, Map, MapControls, Sources} from "vue3-openlayers";
// 导入GeoServer REST API类
import GeoServerRestApi from '../geoserver/GeoServerRestApi';
// 导入AI对话框组件
import AiChatDialog from './AiChatDialog.vue';
// 导入水务管理面板组件
import WaterManagementPanel from './WaterManagementPanel.vue';
// 导入OpenLayers用于GeoJSON处理
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {Style, Stroke, Fill, Circle} from 'ol/style';

// ========== 响应式数据定义 ==========

/** 地图中心点坐标 [经度, 纬度] */
const center = ref([119, 32]);

/** 地图投影坐标系 */
const projection = ref("EPSG:4326");

/** 地图初始缩放级别 */
const zoom = ref(10);

/** 动态图层列表：存储从GeoServer获取的单独图层 */
const dynamicLayerList = ref([]);

/** 动态图层组列表：存储从GeoServer获取的图层组 */
const dynamicLayerGroupList = ref([]);

/** 地图实例引用 */
const mapRef = ref<MapRef | null>(null);

// ========== AI对话框相关数据 ==========

/** AI对话框始终可见 - AI优先设计 */
// chatDialogVisible 不再需要，AI对话框永远显示

/** 水务管理面板显示状态 - 仅用于内部功能整合 */
const waterPanelVisible = ref(false);

/** GeoJSON向量图层列表 - 支持多个图层叠加 */
const geoJsonLayers = ref([]);

// ========== 生命周期钩子 ==========

/**
 * 组件挂载后执行
 * 主要功能：从GeoServer加载图层和图层组数据
 */
onMounted(async () => {
  try {
    // 创建GeoServer REST API实例
    let geoServerRestApi = new GeoServerRestApi();

    // ========== 加载单独图层 ==========
    
    // 获取所有图层列表
    let layers = await geoServerRestApi.layers.getLayers();
    let layerList = layers.layers.layer;
    
    // 遍历图层列表，配置每个图层
    layerList.forEach((layer: any) => {
      let layerName = layer.name;
      dynamicLayerList.value.push({
          name: layerName,                 // 图层名称
          url: `/geoserver/wms`,          // WMS服务URL
          visible: true,                  // 默认可见
        });
    });

    // ========== 加载图层组 ==========
    
    // 获取所有图层组列表
    let groups = await geoServerRestApi.layers.getLayerGroups();
    
    // 遍历图层组列表
    for (let group of groups.layerGroups.layerGroup) {
      let groupName = group.name;
      
      // 获取图层组详细信息
      let groupLayers = await geoServerRestApi.layers.getLayerGroup(groupName);
      
      // 创建图层组对象
      let layerGroups = {
        name: groupName,                  // 图层组名称
        layers: [],                       // 图层组内的图层列表
        visible: false,                   // 默认隐藏
      };
      
      // 遍历图层组内的已发布对象
      groupLayers.layerGroup.publishables.published.forEach((layer: any) => {
        // 只处理类型为"layer"的对象，跳过其他类型
        if (layer["@type"] !== "layer") return;

        // 添加图层到图层组
        layerGroups.layers.push({
          name: layer.name,               // 图层名称
          url: `/geoserver/wms`,         // WMS服务URL
          visible: false,                // 默认隐藏
        });
      });
      
      // 将配置好的图层组添加到列表
      dynamicLayerGroupList.value.push(layerGroups);
    }
  } catch (error) {
    // 错误处理：记录加载失败信息
    console.error("Failed to load layers:", error);
  }
});

// ========== AI对话框相关方法 ==========

/**
 * 关闭AI对话框 - 在AI优先设计中不常用，但保留接口兼容性
 * 注意：AI对话框现在始终可见，此方法主要用于接口兼容
 */
const closeChatDialog = () => {
  // AI对话框始终可见，不执行关闭操作
  console.log('AI对话框始终可见，AI优先设计');
};

/**
 * 关闭水务管理面板 - 保留用于内部功能整合
 */
const closeWaterPanel = () => {
  waterPanelVisible.value = false;
};

/**
 * 处理AI返回的GeoJSON数据
 * @param geoJson AI返回的GeoJSON对象
 */
const handleGeoJsonReceived = (geoJson) => {
  if (!geoJson || !mapRef.value) return;
  
  try {
    // 获取实际的OpenLayers Map对象
    const map = mapRef.value.map;
    
    if (!map) {
      console.error('无法获取地图实例');
      return;
    }
    
    // 创建GeoJSON格式解析器
    const format = new GeoJSON();
    
    // 创建向量数据源
    const source = new VectorSource({
      features: format.readFeatures(geoJson, {
        featureProjection: 'EPSG:4326'
      })
    });
    
    // 创建增强的样式函数
    const getFeatureStyle = (feature) => {
      const geometry = feature.getGeometry();
      const geometryType = geometry.getType();
      
      if (geometryType === 'Point') {
        // 点：动态涟漪标记
        return new Style({
          image: new Circle({
            radius: 12,
            fill: new Fill({
              color: 'rgba(52, 152, 219, 0.8)'
            }),
            stroke: new Stroke({
              color: '#3498db',
              width: 3
            })
          }),
          // 外层涟漪效果
          stroke: new Stroke({
            color: 'rgba(52, 152, 219, 0.3)',
            width: 8
          })
        });
      } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
        // 线条：渐变色流动效果
        return new Style({
          stroke: new Stroke({
            color: '#e74c3c',
            width: 4,
            lineDash: [10, 5],
            lineDashOffset: 0
          })
        });
      } else {
        // 多边形：半透明填充 + 脉冲边界
        return new Style({
          stroke: new Stroke({
            color: '#e74c3c',
            width: 3
          }),
          fill: new Fill({
            color: 'rgba(231, 76, 60, 0.15)'
          })
        });
      }
    };
    
    // 创建向量图层
    const newLayer = new VectorLayer({
      source: source,
      style: getFeatureStyle,
      opacity: 0
    });
    
    // 添加图层到地图（智能叠加，不覆盖）
    map.addLayer(newLayer);
    geoJsonLayers.value.push(newLayer);
    
    // 添加淡入动画
    animateLayerFadeIn(newLayer);
    
    // 添加脉冲边界动画（仅对多边形）
    const features = source.getFeatures();
    features.forEach(feature => {
      const geometry = feature.getGeometry();
      if (geometry.getType() === 'Polygon' || geometry.getType() === 'MultiPolygon') {
        startPulseAnimation(feature, newLayer);
      } else if (geometry.getType() === 'Point') {
        startRippleAnimation(feature, newLayer);
      }
    });
    
    // 智能定位到新的GeoJSON数据
    fitToGeoJsonData(geoJson, geoJsonLayers.value.length === 1);
    
  } catch (error) {
    console.error('处理GeoJSON数据失败:', error);
  }
};

/**
 * 清除所有GeoJSON图层（带溶解动画）
 */
const clearGeoJsonLayers = () => {
  if (!mapRef.value) return;
  
  const map = mapRef.value.map;
  if (!map) return;
  
  // 为每个图层添加溶解动画
  geoJsonLayers.value.forEach((layer, index) => {
    animateLayerFadeOut(layer, () => {
      map.removeLayer(layer);
    }, index * 200); // 错开动画时间
  });
  
  // 清空图层数组
  geoJsonLayers.value = [];
  
  // 重置地图视野到初始位置
  setTimeout(() => {
    resetMapView();
  }, geoJsonLayers.value.length * 200 + 500);
};

/**
 * 图层淡入动画
 */
const animateLayerFadeIn = (layer) => {
  let opacity = 0;
  const fadeIn = () => {
    opacity += 0.05;
    layer.setOpacity(opacity);
    if (opacity < 1) {
      requestAnimationFrame(fadeIn);
    }
  };
  requestAnimationFrame(fadeIn);
};

/**
 * 图层淡出动画
 */
const animateLayerFadeOut = (layer, callback, delay = 0) => {
  setTimeout(() => {
    let opacity = layer.getOpacity();
    const fadeOut = () => {
      opacity -= 0.08;
      layer.setOpacity(Math.max(0, opacity));
      if (opacity > 0) {
        requestAnimationFrame(fadeOut);
      } else {
        callback();
      }
    };
    requestAnimationFrame(fadeOut);
  }, delay);
};

/**
 * 多边形脉冲边界动画
 */
const startPulseAnimation = (feature, layer) => {
  let pulse = 0;
  const animate = () => {
    pulse += 0.1;
    const width = 3 + Math.sin(pulse) * 2;
    const alpha = 0.5 + Math.sin(pulse) * 0.3;
    
    const style = new Style({
      stroke: new Stroke({
        color: `rgba(231, 76, 60, ${alpha})`,
        width: width
      }),
      fill: new Fill({
        color: 'rgba(231, 76, 60, 0.15)'
      })
    });
    
    feature.setStyle(style);
    requestAnimationFrame(animate);
  };
  animate();
};

/**
 * 点涟漪动画
 */
const startRippleAnimation = (feature, layer) => {
  let ripple = 0;
  const animate = () => {
    ripple += 0.15;
    const radius = 12 + Math.sin(ripple) * 6;
    const alpha = 0.8 - Math.abs(Math.sin(ripple)) * 0.3;
    
    const style = new Style({
      image: new Circle({
        radius: radius,
        fill: new Fill({
          color: `rgba(52, 152, 219, ${alpha})`
        }),
        stroke: new Stroke({
          color: '#3498db',
          width: 3
        })
      })
    });
    
    feature.setStyle(style);
    requestAnimationFrame(animate);
  };
  animate();
};

/**
 * 重置地图视野到初始位置
 */
const resetMapView = () => {
  if (!mapRef.value) return;
  
  const map = mapRef.value.map;
  if (!map) return;
  
  const view = map.getView();
  view.animate({
    center: [112, 25],
    zoom: 10,
    duration: 1000
  });
};

/**
 * 将地图视图定位到GeoJSON数据范围
 * @param geoJson GeoJSON对象
 * @param isFirstLayer 是否是第一个图层（决定是否使用动画）
 */
const fitToGeoJsonData = (geoJson, isFirstLayer = false) => {
  if (!mapRef.value || !geoJson) return;
  
  try {
    // 获取实际的OpenLayers Map对象
    const map = mapRef.value.map;
    
    if (!map) {
      console.error('无法获取地图实例');
      return;
    }
    
    // 计算GeoJSON数据的边界框
    const bounds = calculateGeoJsonBounds(geoJson);
    
    if (bounds) {
      // 设置地图视图以适应边界框
      const view = map.getView();
      
      // 计算中心点
      const centerLon = (bounds.minLon + bounds.maxLon) / 2;
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      
      // 计算合适的缩放级别
      const lonDiff = bounds.maxLon - bounds.minLon;
      const latDiff = bounds.maxLat - bounds.minLat;
      const maxDiff = Math.max(lonDiff, latDiff);
      
      let zoomLevel = 10;
      if (maxDiff < 0.01) zoomLevel = 15;
      else if (maxDiff < 0.1) zoomLevel = 12;
      else if (maxDiff < 1) zoomLevel = 9;
      else if (maxDiff < 5) zoomLevel = 7;
      else zoomLevel = 5;
      
      // 如果是第一个图层或用户要求，使用动画定位
      if (isFirstLayer) {
        view.animate({
          center: [centerLon, centerLat],
          zoom: zoomLevel,
          duration: 1500
        });
      } else {
        // 多个图层时，计算包含所有图层的边界
        const allBounds = calculateAllLayersBounds();
        if (allBounds) {
          const allCenterLon = (allBounds.minLon + allBounds.maxLon) / 2;
          const allCenterLat = (allBounds.minLat + allBounds.maxLat) / 2;
          const allLonDiff = allBounds.maxLon - allBounds.minLon;
          const allLatDiff = allBounds.maxLat - allBounds.minLat;
          const allMaxDiff = Math.max(allLonDiff, allLatDiff);
          
          let allZoomLevel = 10;
          if (allMaxDiff < 0.01) allZoomLevel = 15;
          else if (allMaxDiff < 0.1) allZoomLevel = 12;
          else if (allMaxDiff < 1) allZoomLevel = 9;
          else if (allMaxDiff < 5) allZoomLevel = 7;
          else allZoomLevel = 5;
          
          view.animate({
            center: [allCenterLon, allCenterLat],
            zoom: allZoomLevel,
            duration: 1000
          });
        }
      }
    }
  } catch (error) {
    console.error('定位到GeoJSON数据失败:', error);
  }
};

/**
 * 计算所有图层的综合边界框
 */
const calculateAllLayersBounds = () => {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  geoJsonLayers.value.forEach(layer => {
    const source = layer.getSource();
    const features = source.getFeatures();
    
    features.forEach(feature => {
      const geometry = feature.getGeometry();
      const extent = geometry.getExtent();
      minLon = Math.min(minLon, extent[0]);
      maxLon = Math.max(maxLon, extent[2]);
      minLat = Math.min(minLat, extent[1]);
      maxLat = Math.max(maxLat, extent[3]);
    });
  });
  
  if (minLon !== Infinity) {
    return { minLon, maxLon, minLat, maxLat };
  }
  return null;
};

/**
 * 计算GeoJSON数据的边界框
 * @param geoJson GeoJSON对象
 * @returns 边界框对象或null
 */
const calculateGeoJsonBounds = (geoJson) => {
  try {
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    const processCoordinates = (coords, type) => {
      if (type === 'Point') {
        const [lon, lat] = coords;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      } else if (type === 'Polygon') {
        coords[0].forEach(([lon, lat]) => {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      }
    };
    
    if (geoJson.type === 'FeatureCollection') {
      geoJson.features.forEach(feature => {
        processCoordinates(feature.geometry.coordinates, feature.geometry.type);
      });
    } else if (geoJson.type === 'Feature') {
      processCoordinates(geoJson.geometry.coordinates, geoJson.geometry.type);
    }
    
    if (minLon !== Infinity) {
      return { minLon, maxLon, minLat, maxLat };
    }
    
    return null;
  } catch (error) {
    console.error('计算边界框失败:', error);
    return null;
  }
};

// ========== 水务管理功能方法 ==========

/**
 * 处理AI返回的额外数据
 * @param additionalData AI返回的额外数据对象
 */
const handleAdditionalDataReceived = (additionalData) => {
  console.log('收到额外数据:', additionalData);
  // 这里可以根据数据类型做特定处理，如显示图表、生成报告等
  
  // 如果是统计数据，可以触发图表显示
  if (additionalData.type === 'statisticsReport') {
    // 可以在这里触发显示统计图表的逻辑
    console.log('统计报表数据:', additionalData.statistics);
  }
  
  // 如果是数据验证结果，可以显示验证状态
  if (additionalData.type === 'dataValidation') {
    console.log('数据验证结果:', additionalData.validation);
  }
};

/**
 * 处理水务管理面板查询
 * @param result 查询结果
 */
const handleWaterManagementQuery = (result) => {
  console.log('水务管理查询结果:', result);
  
  // 处理GeoJSON数据
  if (result.geoJson) {
    handleGeoJsonReceived(result.geoJson);
  }
  
  // 处理额外数据
  if (result.additionalData) {
    handleAdditionalDataReceived(result.additionalData);
  }
  
  // 关闭水务管理面板
  closeWaterPanel();
  
  // 如果AI对话框未打开，可以选择性打开以显示结果
  if (!chatDialogVisible.value) {
    // 这里可以选择是否自动打开AI对话框来显示详细结果
    // chatDialogVisible.value = true;
  }
};

/**
 * 创建水务资产专用样式
 * @param feature GeoJSON特征对象
 * @returns OpenLayers样式对象
 */
const createWaterAssetStyle = (feature) => {
  const properties = feature.getProperties();
  const assetType = properties.assetType || '';
  const material = properties.material || '';
  const status = properties.status || '正常';
  const riskLevel = properties.riskLevel || '低';
  
  // 根据资产类型和状态选择颜色
  let strokeColor = '#3498db'; // 默认蓝色
  let fillColor = 'rgba(52, 152, 219, 0.2)';
  
  // 根据资产类型调整颜色
  if (assetType.includes('管线')) {
    strokeColor = material === '铸铁' ? '#e67e22' : '#27ae60';
    fillColor = material === '铸铁' ? 'rgba(230, 126, 34, 0.3)' : 'rgba(39, 174, 96, 0.3)';
  } else if (assetType.includes('阀门')) {
    strokeColor = '#8e44ad';
    fillColor = 'rgba(142, 68, 173, 0.3)';
  } else if (assetType.includes('水表')) {
    strokeColor = '#f39c12';
    fillColor = 'rgba(243, 156, 18, 0.3)';
  }
  
  // 根据状态调整透明度和样式
  if (status === '维护中') {
    strokeColor = '#e74c3c';
    fillColor = 'rgba(231, 76, 60, 0.4)';
  }
  
  // 根据风险等级调整边框宽度
  let strokeWidth = 2;
  if (riskLevel === '高') {
    strokeWidth = 4;
  } else if (riskLevel === '中') {
    strokeWidth = 3;
  }
  
  return new Style({
    stroke: new Stroke({
      color: strokeColor,
      width: strokeWidth
    }),
    fill: new Fill({
      color: fillColor
    }),
    image: new Circle({
      radius: assetType.includes('管线') ? 6 : 8,
      stroke: new Stroke({
        color: strokeColor,
        width: strokeWidth
      }),
      fill: new Fill({
        color: fillColor
      })
    })
  });
};
</script>

<style scoped>
/* 地图容器样式 */
#map {
  width: 100%;      /* 宽度占满父容器 */
  height: 100%;     /* 高度占满父容器 */
  position: absolute; /* 绝对定位 */
  top: 0;           /* 顶部对齐 */
  left: 0;          /* 左侧对齐 */
}

/* 
  AI优先设计 - 移除了传统控制按钮样式
  所有功能通过底部中央的AI对话框实现
*/
</style>