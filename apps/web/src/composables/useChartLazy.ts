import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import type { ChartConfiguration, ChartType, ChartData, ChartOptions } from 'chart.js';

// Lazy-loaded Chart.js for better performance
let Chart: any = null;
let chartComponents: any = null;

const loadChartJS = async () => {
  if (Chart) return Chart;
  
  const [
    { Chart: ChartClass },
    {
      CategoryScale,
      LinearScale,
      BarElement,
      LineElement,
      PointElement,
      ArcElement,
      Title,
      Tooltip,
      Legend,
      Filler
    }
  ] = await Promise.all([
    import('chart.js/auto'),
    import('chart.js')
  ]);

  // Register Chart.js components
  ChartClass.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  Chart = ChartClass;
  chartComponents = {
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
  };

  return Chart;
};

export interface ChartConfig {
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
}

export const useChart = (canvasRef: Ref<HTMLCanvasElement | null>, config: Ref<ChartConfig>) => {
  const chartInstance = ref<any>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  const createChart = async () => {
    if (!canvasRef.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      // Lazy load Chart.js
      const ChartClass = await loadChartJS();

      // Destroy existing chart
      if (chartInstance.value) {
        chartInstance.value.destroy();
      }

      // Create new chart
      chartInstance.value = new ChartClass(canvasRef.value, {
        type: config.value.type,
        data: config.value.data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...config.value.options,
        },
      });

      isLoading.value = false;
    } catch (err) {
      error.value = `Failed to load chart: ${err instanceof Error ? err.message : 'Unknown error'}`;
      isLoading.value = false;
    }
  };

  const updateChart = async () => {
    if (!chartInstance.value) {
      await createChart();
      return;
    }

    // Update chart data and options
    chartInstance.value.data = config.value.data;
    if (config.value.options) {
      chartInstance.value.options = {
        ...chartInstance.value.options,
        ...config.value.options,
      };
    }
    chartInstance.value.update();
  };

  const destroyChart = () => {
    if (chartInstance.value) {
      chartInstance.value.destroy();
      chartInstance.value = null;
    }
  };

  // Watch for config changes
  watch(config, updateChart, { deep: true });

  // Lifecycle hooks
  onMounted(createChart);
  onUnmounted(destroyChart);

  return {
    chartInstance,
    isLoading,
    error,
    createChart,
    updateChart,
    destroyChart,
  };
};

// Chart color palettes for consistent styling
export const chartColors = {
  primary: '#3880ff',
  secondary: '#3dc2ff',
  tertiary: '#5260ff',
  success: '#2dd36f',
  warning: '#ffc409',
  danger: '#eb445a',
  dark: '#222428',
  medium: '#92949c',
  light: '#f4f5f8',
};

// Pre-configured chart options for common use cases
export const chartConfigs = {
  bar: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: chartColors.primary,
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(200, 200, 200, 0.2)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  },
  line: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: chartColors.primary,
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(200, 200, 200, 0.2)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    elements: {
      line: {
        tension: 0.1,
      },
      point: {
        radius: 4,
        hoverRadius: 6,
      },
    },
  },
  doughnut: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: chartColors.primary,
        borderWidth: 1,
      },
    },
    cutout: '60%',
  },
};
