// 설정된 위치 저장 변수
let currentPosition = 'default';
let currentHeight = 'default';
let customHeightValue = 200;
let checkInterval;
let lastBannerParent = null;

// CSS 적용 상태 추적
let appliedStyles = {
  height: null,
  background: null
};

// 투명도 오프셋 캐시
let transparentOffsetCache = new Map();

// 버튼 및 클릭 제어 관련 변수
let detailButtons = []; // 여러 버튼을 관리하기 위해 배열로 변경
let isClickAllowed = false;
let bannerClickElements = [];
let lastSlideCount = 0; // 마지막으로 확인한 슬라이드 개수

// 위치별 타겟 셀렉터 매핑
const positionSelectors = {
  'default': '.css-z8pb2s.e1cpvx0q7',       // 기본 - css-z8pb2s.e1cpvx0q7 아래
  'top': '.css-z8pb2s.e1cpvx0q7',           // 가장 위
  'popular': '.css-7h5hcy.e1sjtu897',       // 인기 작품 아래
  'explore': '.css-dyia57.e1mv8wxh5',       // 탐험하기 아래
  'notable': '.css-jsqapq.e14qd5585',       // 주목할 만한 작품 아래
  'theme': '.css-xi6mor.e1vg7g457',         // 주제 작품 아래
  'entry': '.css-1ijsro6.ejhe9tc6',         // 주목할 만한 엔둥이 아래
  'challenge': '.css-xqwq31.e1ciudld3',     // 챌린지 아래
  'remake': '.css-d4yoyc.e1lx7wud3',        // 화제의 리메이크 작품 아래
  'bottom': '.css-d4yoyc.e1lx7wud3'         // 가장 아래 (같은 셀렉터, 다른 위치)
};

// 높이 설정 매핑
const heightSettings = {
  'large': '400px',
  'default': '160px'
};

// 동적 스타일시트 관리
let dynamicStyleSheet = null;

// 동적 스타일시트 생성 또는 가져오기
function getDynamicStyleSheet() {
  if (!dynamicStyleSheet) {
    const style = document.createElement('style');
    style.id = 'entry-banner-extension-styles';
    document.head.appendChild(style);
    dynamicStyleSheet = style.sheet;
  }
  return dynamicStyleSheet;
}

// CSS 룰 제거
function removeCSSRule(selector) {
  const sheet = getDynamicStyleSheet();
  const rules = sheet.cssRules || sheet.rules;
  
  for (let i = rules.length - 1; i >= 0; i--) {
    if (rules[i].selectorText === selector) {
      sheet.deleteRule(i);
    }
  }
}

/*
================================= 중요한 주석 =================================
"아래"라고 표기되어 있어도 실제로는 해당 요소의 **위**에 배너를 이동시킵니다!

- "인기 작품 아래" = 인기 작품 요소의 위에 배너 배치 (인기 작품 제목 아래, 컨텐츠 위)
- "탐험하기 아래" = 탐험하기 요소의 위에 배너 배치
- "주목할 만한 작품 아래" = 주목할 만한 작품 요소의 위에 배너 배치
- 기타 등등...

**예외: "가장 아래"만 실제로 해당 요소의 아래에 배치합니다.**
============================================================================
*/

// 배너 요소 찾기
function findBannerElement() {
  return document.querySelector('.css-bppvkk.e2q6ddu7');
}

// 현재 보이는 활성 배너 슬라이드 찾기
function findCurrentActiveBannerSlide() {
  const bannerContainer = findBannerElement();
  if (!bannerContainer) return null;
  
  const viewport = bannerContainer.querySelector('.flicking-viewport');
  if (!viewport) return null;
  
  const slides = bannerContainer.querySelectorAll('.css-57ktbb');
  if (slides.length === 0) return null;
  
  // 뷰포트 경계 계산
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.left + viewportRect.width / 2;
  
  // 뷰포트 중앙에 가장 가까운 슬라이드 찾기
  let closestSlide = null;
  let minDistance = Infinity;
  
  slides.forEach(slide => {
    const slideRect = slide.getBoundingClientRect();
    const slideCenter = slideRect.left + slideRect.width / 2;
    const distance = Math.abs(viewportCenter - slideCenter);
    
    // 슬라이드가 뷰포트와 겹치고 있고, 중앙에 더 가까운 경우
    if (slideRect.right > viewportRect.left && slideRect.left < viewportRect.right) {
      if (distance < minDistance) {
        minDistance = distance;
        closestSlide = slide;
      }
    }
  });
  
  return closestSlide;
}

// 실제 배너 내부의 높이 조정 대상 요소 찾기
function findCurrentBannerHeightTarget() {
  // 현재 활성 슬라이드를 직접 반환 (슬라이드 자체가 높이 대상)
  return findCurrentActiveBannerSlide();
}

// 높이 조정 대상 요소 찾기 (폴백용)
function findHeightTargetElement() {
  return document.querySelector('.css-57ktbb');
}

// background-size 대상 요소 찾기 (폴백용)
function findBackgroundTargetElement() {
  return document.querySelector('.css-ar944u');
}

// 실제 배너 내부의 배경 대상 요소 찾기
function findCurrentBannerBackgroundTarget() {
  const activeSlide = findCurrentActiveBannerSlide();
  if (activeSlide) {
    return activeSlide.querySelector('.css-ar944u');
  }
  
  // 폴백으로 전체에서 찾기
  return findBackgroundTargetElement();
}

// 배경 이미지 URL 추출
function getBackgroundImageUrl(element) {
  const computedStyle = window.getComputedStyle(element);
  const backgroundImage = computedStyle.backgroundImage;
  
  if (backgroundImage && backgroundImage !== 'none') {
    const matches = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    return matches ? matches[1] : null;
  }
  return null;
}

// 300px 이상일 때만 하드코딩 투명도 오프셋
function getHardcodedTransparentOffset() {
  if (currentHeight === 'large') {
    return 15; // 400px일 때 
  } else if (currentHeight === 'custom' && customHeightValue >= 300) {
    return 15; // 300px 이상일 때 
  } else {
    return 0; // 300px 미만일 때는 적용하지 않음
  }
}

// 배너 높이 적용
function applyBannerHeight() {
  const targetElement = findCurrentBannerHeightTarget();
  if (!targetElement) {
    return;
  }
  
  let heightValue;
  if (currentHeight === 'custom') {
    heightValue = customHeightValue + 'px';
  } else {
    heightValue = heightSettings[currentHeight] || '160px';
  }
  
  // 이미 적용된 높이와 같다면 스킵
  const heightKey = `${currentHeight}-${customHeightValue}`;
  if (appliedStyles.height === heightKey) {
    return;
  }
  
  const sheet = getDynamicStyleSheet();
  const selector = '.css-57ktbb';
  const centerSelector = '.css-1agm2sx';
  
  // 기존 룰 제거
  removeCSSRule(selector);
  removeCSSRule(centerSelector);
  
  // 높이 룰 추가
  const heightRule = `${selector} { height: ${heightValue} !important; }`;
  sheet.insertRule(heightRule, sheet.cssRules.length);
  
  // 크게(400px)일 때 중앙 정렬 추가
  if (currentHeight === 'large' || (currentHeight === 'custom' && customHeightValue >= 300)) {
    const centerRule = `${centerSelector} { 
      position: relative !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
    }`;
    sheet.insertRule(centerRule, sheet.cssRules.length);
  }
  
  appliedStyles.height = heightKey;
}

// background-size 적용 (하드코딩 버전)
function applyBackgroundSize() {
  const targetElement = findCurrentBannerBackgroundTarget();
  if (!targetElement) {
    return;
  }
  
  // 300px 이상일 때만 적용
  if (currentHeight === 'large' || (currentHeight === 'custom' && customHeightValue >= 300)) {
    // 하드코딩된 오프셋 사용
    const offsetPercent = getHardcodedTransparentOffset();
    
    // 투명한 부분만큼 빼서 실제 내용이 오른쪽에 딱 붙게 하기
    const backgroundPosition = `calc(100% - ${offsetPercent}%) center`;
    
    const backgroundKey = `hardcoded-${currentHeight}-${customHeightValue}-${offsetPercent}`;
    
    if (appliedStyles.background === backgroundKey) {
      return;
    }
    
    const sheet = getDynamicStyleSheet();
    const selector = '.css-ar944u';
    const parentSelector = '.css-57ktbb'; // 부모 요소도 함께 조정
    
    // 기존 룰 제거
    removeCSSRule(selector);
    removeCSSRule(parentSelector + ' .css-ar944u');
    
    // 배경 이미지 요소 룰 추가
    const rule = `${selector} { 
      background-size: auto 100% !important; 
      background-position: ${backgroundPosition} !important; 
      background-clip: border-box !important;
      background-origin: border-box !important;
    }`;
    sheet.insertRule(rule, sheet.cssRules.length);
    
    // 부모 요소도 조정 (overflow와 크기)
    const parentRule = `${parentSelector} { 
      overflow: visible !important;
    }`;
    sheet.insertRule(parentRule, sheet.cssRules.length);
    
    appliedStyles.background = backgroundKey;
  } else {
    // 300px 미만일 때: 기존 룰 제거 (원래 CSS 그대로 사용)
    if (appliedStyles.background !== 'default') {
      const sheet = getDynamicStyleSheet();
      const selector = '.css-ar944u';
      const parentSelector = '.css-57ktbb';
      
      removeCSSRule(selector);
      removeCSSRule(parentSelector);
      
      appliedStyles.background = 'default';
    }
  }
}

// 타겟 위치 요소 찾기
function findTargetElement(position) {
  const selector = positionSelectors[position];
  if (!selector) return null;
  
  return document.querySelector(selector);
}

// 배너가 올바른 위치에 있는지 확인
function isBannerInCorrectPosition(banner, position) {
  const targetElement = findTargetElement(position);
  if (!targetElement) return false;
  
  if (position === 'default' || position === 'bottom') {
    // 기본과 가장 아래: 타겟 요소 아래에 있어야 함
    return targetElement.nextElementSibling === banner;
  } else {
    // 나머지 모든 위치 ("아래"라고 표기되어도): 타겟 요소 위에 있어야 함
    return targetElement.previousElementSibling === banner;
  }
}

// 배너를 지정된 위치로 이동
function moveBannerToPosition(banner, position) {
  const targetElement = findTargetElement(position);
  if (!targetElement) {
    return;
  }
  
  try {
    if (position === 'default' || position === 'bottom') {
      // 기본과 가장 아래: 타겟 요소 뒤에 삽입 (실제로 아래에 배치)
      if (targetElement.nextSibling) {
        targetElement.parentElement.insertBefore(banner, targetElement.nextSibling);
      } else {
        targetElement.parentElement.appendChild(banner);
      }
    } else {
      // 나머지 모든 위치: 타겟 요소 앞에 삽입 (아래라고 표기되어도 실제로는 위에 배치)
      targetElement.parentElement.insertBefore(banner, targetElement);
    }
  } catch (error) {
    console.error('Error moving banner:', error);
  }
}

// 배너 위치 체크 및 이동 함수
function checkAndMoveBanner() {
  const banner = findBannerElement();
  
  if (!banner) {
    // 배너를 찾지 못함
    return;
  }
  
  // 현재 배너가 올바른 위치에 있는지 확인
  if (isBannerInCorrectPosition(banner, currentPosition)) {
    // 이미 올바른 위치에 있음
    return;
  }
  
  // 배너를 올바른 위치로 이동
  moveBannerToPosition(banner, currentPosition);
}

// 모든 스타일 적용 함수 (조건부)
function applyAllStyles() {
  // 대상 요소가 존재할 때만 적용
  if (findCurrentBannerHeightTarget()) {
    applyBannerHeight();
  }
  if (findCurrentBannerBackgroundTarget()) {
    applyBackgroundSize();
  }
  
  // 배너 클릭 제어 적용
  applyBannerClickControl();
}

// 캐시 리셋
function resetStyleCache() {
  appliedStyles.height = null;
  appliedStyles.background = null;
}

// 설정 불러오기
function loadSettings() {
  chrome.storage.sync.get(['bannerPosition', 'bannerHeight', 'customHeight'], function(result) {
    currentPosition = result.bannerPosition || 'default';
    currentHeight = result.bannerHeight || 'default';
    customHeightValue = result.customHeight || 200;
    
    // 설정 로드 후 캐시 리셋하고 스타일 적용
    resetStyleCache();
    setTimeout(() => {
      applyAllStyles();
    }, 500);
  });
}

// 체크 인터벌 시작
function startChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  checkInterval = setInterval(() => {
    checkAndMoveBanner();
    // 스타일 적용은 대상 요소가 있을 때만
    if (findCurrentBannerHeightTarget() || findCurrentBannerBackgroundTarget()) {
      applyAllStyles();
    }
    
    // 슬라이드 변화 감지 및 재적용
    checkAndReapplyIfNeeded();
  }, 500);
}

// 체크 인터벌 중지
function stopChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updatePosition') {
    currentPosition = request.position;
    
    // 즉시 한 번 체크
    checkAndMoveBanner();
  } else if (request.action === 'updateHeight') {
    currentHeight = request.height;
    if (request.customValue) {
      customHeightValue = request.customValue;
    }
    
    // 캐시 리셋하고 즉시 적용
    resetStyleCache();
    applyBannerHeight();
    applyBackgroundSize();
    
    // 배너 클릭 제어 적용
    applyBannerClickControl();
  }
});

// 스토리지 변경 리스너
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.bannerPosition) {
    currentPosition = changes.bannerPosition.newValue || 'default';
  }
  if (changes.bannerHeight) {
    currentHeight = changes.bannerHeight.newValue || 'default';
    resetStyleCache();
    applyBannerHeight();
    applyBackgroundSize();
    
    // 배너 클릭 제어 적용
    applyBannerClickControl();
  }
  if (changes.customHeight) {
    customHeightValue = changes.customHeight.newValue || 200;
    if (currentHeight === 'custom') {
      resetStyleCache();
      applyBannerHeight();
      applyBackgroundSize();
      
      // 배너 클릭 제어 적용
      applyBannerClickControl();
    }
  }
});

// 초기화
function init() {
  loadSettings();
  
  // 페이지가 완전히 로드된 후 체크 시작
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startChecking);
  } else {
    startChecking();
  }
}

// URL 변경 감지 (SPA 대응)
let currentUrl = window.location.href;
const urlObserver = new MutationObserver(function() {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    
    // 기존 버튼 제거 (새 페이지에서 다시 생성)
    removeBannerClickBlocking();
    
    // 잠시 대기 후 다시 체크 시작
    setTimeout(() => {
      checkAndMoveBanner();
      applyAllStyles();
    }, 1000);
  }
});

// 페이지 변경 감지 시작
urlObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// 확장 프로그램 초기화
init();

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
  stopChecking();
  urlObserver.disconnect();
});

// 슬라이드 개수 변화 감지 및 재적용
function checkAndReapplyIfNeeded() {
  if (!shouldDisableBannerClick()) return;
  
  const currentSlides = findAllBannerSlides();
  const currentSlideCount = currentSlides.length;
  
  // 실제 DOM에 있는 버튼 개수 확인
  const actualButtonCount = document.querySelectorAll('button[style*="background-color: rgba(0, 0, 0, 0.3)"]').length;
  
  // 슬라이드 개수가 변했거나, 실제 버튼 개수와 일치하지 않으면 재적용
  if (currentSlideCount !== lastSlideCount || actualButtonCount !== currentSlideCount) {
    applyBannerClickControl();
  }
}

// 모든 슬라이드에 클릭 제어 적용
function applyBannerClickControl() {
  if (shouldDisableBannerClick()) {
    const slides = findAllBannerSlides();
    const currentSlideCount = slides.length;
    
    // 슬라이드 개수가 변했을 때만 전체 재구성
    if (currentSlideCount !== lastSlideCount) {
      removeAllBannerClickBlocking();
    }
    
    lastSlideCount = currentSlideCount;
    
    slides.forEach((slide, index) => {
      // 각 슬라이드에 클릭 차단 적용
      addClickEventBlockerToSlide(slide);
      
      // 각 슬라이드에 버튼 추가 (이미 있으면 스킵)
      const container = findSlideButtonContainer(slide);
      if (container) {
        // 이미 버튼이 있는지 확인
        const existingButton = container.querySelector('button[style*="background-color: rgba(0, 0, 0, 0.3)"]');
        if (!existingButton) {
          const button = createDetailButtonForSlide(slide);
          container.appendChild(button);
          detailButtons.push(button);
        }
      }
    });
  } else {
    // 배너 클릭 차단 해제 및 모든 버튼 제거
    removeAllBannerClickBlocking();
    lastSlideCount = 0;
  }
}

// 모든 배너 슬라이드 찾기
function findAllBannerSlides() {
  const bannerContainer = findBannerElement();
  if (!bannerContainer) return [];
  
  return bannerContainer.querySelectorAll('.css-57ktbb');
}

// 특정 슬라이드에서 클릭 대상 찾기
function findSlideClickTarget(slide) {
  return slide.querySelector('.css-ar944u.e2q6ddu5');
}

// 특정 슬라이드에서 버튼 컨테이너 찾기
function findSlideButtonContainer(slide) {
  return slide.querySelector('.css-1agm2sx.e2q6ddu4');
}

// 특정 슬라이드용 버튼 생성
function createDetailButtonForSlide(slide) {
  const button = document.createElement('button');
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 130px;
    height: 35px;
    background-color: rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 13px;
    font-weight: 400;
    border: none;
    border-radius: 17.5px;
    cursor: pointer;
    text-decoration: none;
    gap: 2px;
    padding: 0;
    letter-spacing: -0.4px;
    margin-top: 10px;
    z-index: 9999;
    position: relative;
  `;
  
  // 버튼 내용
  const textSpan = document.createElement('span');
  textSpan.textContent = '자세히 보기';
  
  const arrowSpan = document.createElement('span');
  arrowSpan.style.cssText = 'font-size: 11px; margin-left: 2px;';
  arrowSpan.textContent = '>';
  
  button.appendChild(textSpan);
  button.appendChild(arrowSpan);
  
  // 클릭 이벤트
  button.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    enableClickForSlide(slide);
  }, true);
  
  button.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  }, true);
  
  button.addEventListener('mouseup', function(e) {
    e.stopPropagation();
  }, true);
  
  return button;
}

// 특정 슬라이드의 클릭을 즉시 자동 실행
function enableClickForSlide(slide) {
  const clickTarget = findSlideClickTarget(slide);
  
  if (clickTarget) {
    // 임시로 클릭 허용
    isClickAllowed = true;
    
    // 즉시 해당 슬라이드의 클릭 이벤트 트리거
    clickTarget.click();
    
    // 클릭 허용 상태 해제
    setTimeout(() => {
      isClickAllowed = false;
    }, 100);
  }
}

// 특정 슬라이드에 클릭 차단 및 커서 차단 적용
function addClickEventBlockerToSlide(slide) {
  const clickTarget = findSlideClickTarget(slide);
  if (!clickTarget) return;
  
  // 커서 변화 차단을 위한 CSS 적용
  const sheet = getDynamicStyleSheet();
  const selectorForCursor = '.css-ar944u.e2q6ddu5';
  
  // 기존 커서 룰 제거
  removeCSSRule(selectorForCursor);
  
  // 커서 차단 룰 추가 (클릭 차단 조건에서만)
  if (shouldDisableBannerClick()) {
    const cursorRule = `${selectorForCursor} { cursor: default !important; }`;
    sheet.insertRule(cursorRule, sheet.cssRules.length);
  }
  
  const clickBlocker = function(e) {
    // 우리가 생성한 버튼인지 확인
    const isOurButton = e.target.closest('button[style*="background-color: rgba(0, 0, 0, 0.3)"]');
    
    if (isOurButton) {
      return; // 우리 버튼은 차단하지 않음
    }
    
    if (!isClickAllowed && shouldDisableBannerClick()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  };
  
  // 여러 이벤트에서 차단
  clickTarget.addEventListener('click', clickBlocker, true);
  clickTarget.addEventListener('mousedown', clickBlocker, true);
  clickTarget.addEventListener('mouseup', clickBlocker, true);
}

// 배너 클릭 제어 관련 함수들
function shouldDisableBannerClick() {
  return (currentHeight === 'large') || (currentHeight === 'custom' && customHeightValue >= 300);
}

// 모든 기존 버튼 제거
function removeAllBannerClickBlocking() {
  detailButtons.forEach(button => {
    if (button && button.parentNode) {
      button.parentNode.removeChild(button);
    }
  });
  detailButtons = [];
  
  // 커서 차단 해제
  const sheet = getDynamicStyleSheet();
  const selectorForCursor = '.css-ar944u.e2q6ddu5';
  removeCSSRule(selectorForCursor);
}

// URL 변경 시 정리 (함수명 업데이트)
function removeBannerClickBlocking() {
  removeAllBannerClickBlocking();
} 