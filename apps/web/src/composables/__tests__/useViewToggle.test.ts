import { describe, it, expect, beforeEach, vi } from 'vitest';
// import { nextTick } from 'vue';
import { useViewToggle, resetViewMode } from '../useViewToggle';

// Mock Vue Router
const mockRouter = {
  replace: vi.fn(),
};

const mockRoute = {
  query: {},
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useViewToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    resetViewMode();
  });

  it('should initialize with default landing view when no stored value exists', () => {
    const { viewMode, isMarketingView, isTechnicalView } = useViewToggle();
    
    expect(viewMode.value).toBe('landing');
    expect(isMarketingView.value).toBe(true);
    expect(isTechnicalView.value).toBe(false);
  });

  it('should initialize with stored value from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('technical');
    
    const { viewMode, isMarketingView, isTechnicalView } = useViewToggle();
    
    expect(viewMode.value).toBe('technical');
    expect(isMarketingView.value).toBe(false);
    expect(isTechnicalView.value).toBe(true);
  });

  it('should initialize with URL parameter when present', () => {
    mockRoute.query = { view: 'technical' };
    
    const { viewMode, isMarketingView, isTechnicalView } = useViewToggle();
    
    expect(viewMode.value).toBe('technical');
    expect(isMarketingView.value).toBe(false);
    expect(isTechnicalView.value).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'technical');
  });

  it('should toggle between landing and technical views', () => {
    const { viewMode, toggleView, isMarketingView, isTechnicalView } = useViewToggle();
    
    expect(viewMode.value).toBe('landing');
    
    toggleView();
    
    expect(viewMode.value).toBe('technical');
    expect(isMarketingView.value).toBe(false);
    expect(isTechnicalView.value).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'technical');
    
    toggleView();
    
    expect(viewMode.value).toBe('landing');
    expect(isMarketingView.value).toBe(true);
    expect(isTechnicalView.value).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'landing');
  });

  it('should set specific view mode', () => {
    const { viewMode, setViewMode } = useViewToggle();
    
    setViewMode('technical');
    
    expect(viewMode.value).toBe('technical');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'technical');
    expect(mockRouter.replace).toHaveBeenCalledWith({ query: { view: 'technical' } });
  });

  it('should handle invalid stored values gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid');
    
    const { viewMode } = useViewToggle();
    
    expect(viewMode.value).toBe('landing');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'landing');
  });

  it('should handle invalid URL parameters gracefully', () => {
    mockRoute.query = { view: 'invalid' };
    
    const { viewMode } = useViewToggle();
    
    expect(viewMode.value).toBe('landing');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('demoViewMode', 'landing');
  });

  it('should update URL when view mode changes', () => {
    const { setViewMode } = useViewToggle();
    
    setViewMode('technical');
    
    expect(mockRouter.replace).toHaveBeenCalledWith({ query: { view: 'technical' } });
  });

  it('should preserve existing query parameters when updating view', () => {
    mockRoute.query = { other: 'value' };
    
    const { setViewMode } = useViewToggle();
    
    setViewMode('technical');
    
    expect(mockRouter.replace).toHaveBeenCalledWith({ 
      query: { other: 'value', view: 'technical' } 
    });
  });
});
