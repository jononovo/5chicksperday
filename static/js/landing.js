// Landing page interactions
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const tryFreeBtn = document.getElementById('try-free-btn');
  const examplePrompts = document.querySelectorAll('.example-prompt');
  const videoContainer = document.getElementById('video-container');
  const productBtn = document.getElementById('product-btn');
  const serviceBtn = document.getElementById('service-btn');
  
  // Handle search functionality
  function handleSearch(query = null) {
    const searchQuery = query || searchInput.value.trim();
    if (!searchQuery) return;
    
    // Store the search query for use on the app page
    localStorage.setItem("pendingSearchQuery", searchQuery);
    localStorage.setItem("5ducks_from_landing", "true");
    
    // Navigate to the app
    window.location.href = '/app';
  }
  
  // Handle onboarding start
  window.handleOnboardingStart = function(type) {
    console.log('Onboarding start tracked:', type);
    // Navigate to planning page with type parameter
    window.location.href = `/planning?type=${type}`;
  }
  
  // Search button click
  if (searchBtn) {
    searchBtn.addEventListener('click', () => handleSearch());
  }
  
  // Search input enter key
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
  }
  
  // Example prompt buttons
  examplePrompts.forEach(button => {
    button.addEventListener('click', function() {
      const prompt = this.getAttribute('data-prompt');
      searchInput.value = prompt;
      handleSearch(prompt);
    });
  });
  
  // Mobile menu toggle
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!mobileMenuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.add('hidden');
      }
    });
  }
  
  // Try free button
  if (tryFreeBtn) {
    tryFreeBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  // Video container expansion functionality
  if (videoContainer) {
    let isVideoExpanded = false;
    const videoOverlay = document.getElementById('video-overlay');
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoExpandedContent = document.getElementById('video-expanded-content');
    
    videoContainer.addEventListener('click', function() {
      if (!isVideoExpanded) {
        // Track video play event (placeholder for analytics)
        console.log('Video play tracked: demo_video');
        
        // Expand video
        isVideoExpanded = true;
        videoContainer.classList.remove('w-[60%]', 'cursor-pointer');
        videoContainer.classList.add('w-[90%]', 'shadow-xl');
        
        // Hide overlay and thumbnail, show expanded content
        if (videoOverlay) videoOverlay.classList.add('hidden');
        if (videoThumbnail) videoThumbnail.classList.add('hidden');
        if (videoExpandedContent) videoExpandedContent.classList.remove('hidden');
      }
    });
  }
  
  // Strategic onboarding buttons
  if (productBtn) {
    productBtn.addEventListener('click', function() {
      // Track onboarding start event
      console.log('Onboarding start tracked: product');
      
      // Navigate to planning page with product type
      window.location.href = '/planning?type=product';
    });
  }
  
  if (serviceBtn) {
    serviceBtn.addEventListener('click', function() {
      // Track onboarding start event
      console.log('Onboarding start tracked: service');
      
      // Navigate to planning page with service type
      window.location.href = '/planning?type=service';
    });
  }
});