/**
 * Vue composable for component performance tracking
 */
import { onMounted, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue';
import { trackRender, startTiming, endTiming } from '../utils/performanceMonitor';

export function useComponentPerformance(componentName?: string) {
  const instance = getCurrentInstance();
  const name = componentName || instance?.type.name || 'Unknown';
  let mountStartTime: number;
  let renderStartTime: number;

  /**
   * Track component mount time
   */
  const trackComponentMount = () => {
    mountStartTime = performance.now();
    startTiming(`mount-${name}`, { component: name });
  };

  /**
   * Track component render time
   */
  const trackComponentRender = () => {
    renderStartTime = performance.now();
    
    nextTick(() => {
      const renderTime = performance.now() - renderStartTime;
      trackRender(name, renderTime, instance?.props || {});
    });
  };

  /**
   * Track async operation within component
   */
  const trackAsyncOperation = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const timingName = `${name}-${operationName}`;
    startTiming(timingName);
    
    try {
      const result = await operation();
      endTiming(timingName);
      return result;
    } catch (error) {
      endTiming(timingName);
      throw error;
    }
  };

  /**
   * Track sync operation within component
   */
  const trackSyncOperation = <T>(
    operation: () => T,
    operationName: string
  ): T => {
    const timingName = `${name}-${operationName}`;
    startTiming(timingName);
    
    try {
      const result = operation();
      endTiming(timingName);
      return result;
    } catch (error) {
      endTiming(timingName);
      throw error;
    }
  };

  /**
   * Start tracking when component mounts
   */
  onMounted(() => {
    if (mountStartTime) {
      const mountTime = performance.now() - mountStartTime;
      endTiming(`mount-${name}`);
      
      // Track initial render after mount
      trackComponentRender();
      
      // Log slow mounting components (>50ms)
      if (mountTime > 50) {
        console.warn(`Slow component mount: ${name} took ${mountTime.toFixed(2)}ms`);
      }
    }
  });

  /**
   * Clean up when component unmounts
   */
  onBeforeUnmount(() => {
    // Optional: track unmount time
    startTiming(`unmount-${name}`);
    nextTick(() => {
      endTiming(`unmount-${name}`);
    });
  });

  // Start mount tracking
  trackComponentMount();

  return {
    trackAsyncOperation,
    trackSyncOperation,
    trackComponentRender,
    componentName: name
  };
}

/**
 * Performance tracking decorator for Vue components
 */
export function withPerformanceTracking<T extends Record<string, unknown>>(
  component: T,
  componentName?: string
): T {
  const originalMounted = component.mounted || (() => {});
  const originalUpdated = component.updated || (() => {});
  
  const name = componentName || component.name || 'Component';

  return {
    ...component,
    setup(props: Record<string, unknown>, context: Record<string, unknown>) {
      const { trackComponentRender: _trackComponentRender } = useComponentPerformance(name);
      
      // Track renders on updates
      const originalSetup = component.setup;
      if (originalSetup) {
        return originalSetup(props, context);
      }
      
      return {};
    },
    mounted() {
      originalMounted.call(this);
    },
    updated() {
      // Track render time on updates
      const renderStart = performance.now();
      originalUpdated.call(this);
      
      nextTick(() => {
        const renderTime = performance.now() - renderStart;
        trackRender(name, renderTime, this.$props || {});
      });
    }
  };
}

/**
 * Directive for tracking element render performance
 */
export const vPerformanceTrack = {
  mounted(el: HTMLElement, binding: { value?: string }) {
    const elementName = binding.value || el.tagName.toLowerCase();
    const startTime = performance.now();
    
    // Track when element is fully rendered
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const renderTime = performance.now() - startTime;
          trackRender(`element-${elementName}`, renderTime);
          observer.disconnect();
        }
      });
    });
    
    observer.observe(el);
  }
};