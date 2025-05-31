document.addEventListener('DOMContentLoaded', function() {
  // 저장된 설정 불러오기
  chrome.storage.sync.get(['bannerPosition', 'bannerHeight', 'customHeight'], function(result) {
    // 위치 설정
    const position = result.bannerPosition || 'default';
    const radioButton = document.querySelector(`input[value="${position}"]`);
    if (radioButton) {
      radioButton.checked = true;
    }
    
    // 높이 설정
    const height = result.bannerHeight || 'default';
    const heightRadio = document.querySelector(`input[name="height"][value="${height}"]`);
    if (heightRadio) {
      heightRadio.checked = true;
    }
    
    // 커스텀 높이 설정
    if (height === 'custom') {
      document.getElementById('customHeightInput').style.display = 'block';
      const customHeight = result.customHeight || 200;
      document.getElementById('customHeight').value = customHeight;
    }
  });
  
  // 라디오 버튼 클릭 시 즉시 저장 (위치)
  document.querySelectorAll('input[name="position"]').forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        chrome.storage.sync.set({
          bannerPosition: this.value
        }, function() {
          // 현재 활성 탭에 메시지 전송
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url.includes('playentry.org')) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updatePosition',
                position: radio.value
              });
            }
          });
        });
      }
    });
  });
  
  // 높이 라디오 버튼 클릭 시 즉시 저장
  document.querySelectorAll('input[name="height"]').forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        const customHeightInput = document.getElementById('customHeightInput');
        
        if (this.value === 'custom') {
          customHeightInput.style.display = 'block';
          // 커스텀 입력 필드에 포커스
          document.getElementById('customHeight').focus();
        } else {
          customHeightInput.style.display = 'none';
        }
        
        chrome.storage.sync.set({
          bannerHeight: this.value
        }, function() {
          // 현재 활성 탭에 메시지 전송
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url.includes('playentry.org')) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateHeight',
                height: radio.value
              });
            }
          });
        });
      }
    });
  });
  
  // 커스텀 높이 입력 필드 이벤트
  const customHeightInput = document.getElementById('customHeight');
  customHeightInput.addEventListener('input', function() {
    const value = parseInt(this.value);
    if (value && value >= 50 && value <= 1000) {
      chrome.storage.sync.set({
        customHeight: value
      }, function() {
        // 현재 활성 탭에 메시지 전송
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0] && tabs[0].url.includes('playentry.org')) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'updateHeight',
              height: 'custom',
              customValue: value
            });
          }
        });
      });
    }
  });
}); 