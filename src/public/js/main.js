/**
 * RateFlow - Frontend JavaScript
 * Handles audio upload, recording, analysis, and dashboard functionality
 */

// ============================================
// Utility Functions
// ============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showElement(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.add('visible');
}

function hideElement(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove('visible');
}

function showError(message) {
  const errorEl = $('#errorMessage');
  const errorText = $('#errorText');
  if (errorEl && errorText) {
    errorText.textContent = message;
    showElement(errorEl);
    setTimeout(() => hideElement(errorEl), 5000);
  }
}

// ============================================
// Copy to Clipboard (for API docs)
// ============================================

function initCopyButtons() {
  const copyButtons = $$('[data-copy]');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const codeBlock = btn.previousElementSibling;
      const text = codeBlock.textContent;
      
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
}

// ============================================
// Audio Upload
// ============================================

class AudioUploader {
  constructor() {
    this.uploadZone = $('#uploadZone');
    this.fileInput = $('#fileInput');
    this.audioPreview = $('#audioPreview');
    this.audioPlayer = $('#audioPlayer');
    this.audioFileName = $('#audioFileName');
    this.clearBtn = $('#clearBtn');
    this.submitBtn = $('#submitBtn');
    
    this.audioBlob = null;
    this.audioFile = null;
    
    this.init();
  }
  
  init() {
    if (!this.uploadZone) return;
    
    // Click to upload
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    
    // File selection
    this.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
    
    // Drag and drop
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('dragover');
    });
    
    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('dragover');
    });
    
    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });
    
    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearAudio());
    }
  }
  
  handleFile(file) {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/mp3'];
    const extension = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['mp3', 'wav', 'ogg', 'mp4', 'webm', 'm4a'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      showError('Invalid file format. Please upload MP3, WAV, OGG, MP4, WEBM, or M4A.');
      return;
    }
    
    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      showError('File too large. Maximum size is 15MB.');
      return;
    }
    
    this.audioFile = file;
    this.audioBlob = null;
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    this.audioPlayer.src = url;
    this.audioFileName.textContent = file.name;
    
    showElement(this.audioPreview);
    this.submitBtn.disabled = false;
    
    // Hide results if showing
    hideElement('#resultCard');
  }
  
  clearAudio() {
    this.audioFile = null;
    this.audioBlob = null;
    this.audioPlayer.src = '';
    this.fileInput.value = '';
    
    hideElement(this.audioPreview);
    this.submitBtn.disabled = true;
    hideElement('#resultCard');
  }
  
  getAudioData() {
    if (this.audioFile) {
      return { file: this.audioFile, type: 'file' };
    }
    if (this.audioBlob) {
      return { blob: this.audioBlob, type: 'blob' };
    }
    return null;
  }
}

// ============================================
// Audio Recorder
// ============================================

class AudioRecorder {
  constructor(uploader) {
    this.uploader = uploader;
    this.recordBtn = $('#recordBtn');
    this.timerDisplay = $('#timerDisplay');
    
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
    
    this.init();
  }
  
  init() {
    if (!this.recordBtn) return;
    
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
  }
  
  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }
  
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.uploader.audioBlob = blob;
        this.uploader.audioFile = null;
        
        const url = URL.createObjectURL(blob);
        this.uploader.audioPlayer.src = url;
        this.uploader.audioFileName.textContent = 'Recorded audio';
        
        showElement(this.uploader.audioPreview);
        this.uploader.submitBtn.disabled = false;
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      this.mediaRecorder.start();
      this.isRecording = true;
      
      // Update UI
      this.recordBtn.classList.add('recording');
      this.timerDisplay.classList.add('visible', 'recording');
      
      // Start timer
      this.startTime = Date.now();
      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.timerDisplay.textContent = formatTime(elapsed);
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showError('Could not access microphone. Please check permissions.');
    }
  }
  
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Update UI
      this.recordBtn.classList.remove('recording');
      this.timerDisplay.classList.remove('recording');
      
      // Stop timer
      clearInterval(this.timerInterval);
    }
  }
}

// ============================================
// Rating Submission
// ============================================

class RatingSubmitter {
  constructor(uploader) {
    this.uploader = uploader;
    this.submitBtn = $('#submitBtn');
    this.loadingOverlay = $('#loadingOverlay');
    this.loadingText = $('#loadingText');
    this.resultCard = $('#resultCard');
    
    this.init();
  }
  
  init() {
    if (!this.submitBtn) return;
    
    this.submitBtn.addEventListener('click', () => this.submit());
  }
  
  async submit() {
    const audioData = this.uploader.getAudioData();
    
    if (!audioData) {
      showError('Please upload or record audio first.');
      return;
    }
    
    // Show loading
    this.submitBtn.disabled = true;
    showElement(this.loadingOverlay);
    this.loadingText.textContent = 'Uploading audio...';
    
    try {
      const formData = new FormData();
      
      if (audioData.type === 'file') {
        formData.append('audio', audioData.file);
      } else {
        formData.append('audio', audioData.blob, 'recording.webm');
      }
      
      this.loadingText.textContent = 'Analyzing with AI...';
      
      const response = await fetch('/api/v1/rate', {
        method: 'POST',
        headers: {
          'x-api-key': 'CGview98!!'
        },
        body: formData
      });
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Parse JSON fields if they're strings
        const rating = result.data;
        if (typeof rating.criteria === 'string') {
          rating.criteria = JSON.parse(rating.criteria);
        }
        if (typeof rating.strengths === 'string') {
          rating.strengths = JSON.parse(rating.strengths);
        }
        if (typeof rating.weaknesses === 'string') {
          rating.weaknesses = JSON.parse(rating.weaknesses);
        }
        this.displayResults(rating);
      } else {
        showError(result.error || 'Analysis failed. Please try again.');
      }
      
    } catch (err) {
      console.error('Submission error:', err);
      showError(`Error: ${err.message || 'Network error. Please check your connection and try again.'}`);
    } finally {
      hideElement(this.loadingOverlay);
      this.submitBtn.disabled = false;
    }
  }
  
  displayResults(rating) {
    // Update score
    const scoreNumber = $('#scoreNumber');
    if (scoreNumber) {
      this.animateNumber(scoreNumber, 0, rating.overall_score, 800);
    }
    
    // Update recommendation badge
    const badge = $('#recommendationBadge');
    if (badge) {
      badge.textContent = rating.recommendation;
      badge.className = `recommendation-badge badge-${rating.recommendation.toLowerCase().replace(' ', '-')}`;
    }
    
    // Update transcription
    const transcriptionContent = $('#transcriptionContent');
    if (transcriptionContent && rating.transcription) {
      transcriptionContent.textContent = rating.transcription;
    }
    
    // Update model name
    const modelName = $('#modelName');
    if (modelName && rating.model_used) {
      modelName.textContent = rating.model_used.replace('-litellm', '');
    }
    
    // Update criteria
    this.displayCriteria(rating.criteria);
    
    // Update summary
    const summaryText = $('#summaryText');
    if (summaryText) {
      summaryText.textContent = rating.summary;
    }
    
    // Update strengths
    const strengthsList = $('#strengthsList');
    if (strengthsList) {
      strengthsList.innerHTML = rating.strengths.map(s => `<li>${s}</li>`).join('');
    }
    
    // Update weaknesses
    const weaknessesList = $('#weaknessesList');
    if (weaknessesList) {
      weaknessesList.innerHTML = rating.weaknesses.map(w => `<li>${w}</li>`).join('');
    }
    
    // Show results
    showElement(this.resultCard);
    
    // Scroll to results
    setTimeout(() => {
      this.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
  
  displayCriteria(criteria) {
    const container = $('#criteriaContainer');
    if (!container) return;
    
    const criteriaNames = {
      phone_intelligibility: 'Phone Intelligibility',
      pronunciation_clarity: 'Pronunciation & Clarity',
      business_english_delivery: 'Business English Delivery',
      confidence_sales_tone: 'Confidence & Sales Tone',
      pace_smoothness: 'Pace & Smoothness',
      recording_quality: 'Recording Quality'
    };
    
    container.innerHTML = Object.entries(criteria).map(([key, value]) => `
      <div class="criteria-item">
        <div class="criteria-header">
          <span class="criteria-name">${criteriaNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          <span class="criteria-value">${value}/10</span>
        </div>
        <div class="criteria-bar">
          <div class="criteria-fill" style="width: 0%" data-width="${value * 10}%"></div>
        </div>
      </div>
    `).join('');
    
    // Animate bars
    setTimeout(() => {
      container.querySelectorAll('.criteria-fill').forEach(fill => {
        fill.style.width = fill.dataset.width;
      });
    }, 100);
  }
  
  animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeOut;
      
      element.textContent = current.toFixed(1);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    
    requestAnimationFrame(update);
  }
}

// ============================================
// Dashboard
// ============================================

class Dashboard {
  constructor() {
    this.statsContainer = $('#statsContainer');
    this.ratingsTableBody = $('#ratingsTableBody');
    this.searchInput = $('#searchInput');
    
    this.ratings = [];
    
    this.init();
  }
  
  init() {
    if (!this.statsContainer) return;
    
    this.loadStats();
    this.loadRatings();
    
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.filterRatings(e.target.value));
    }
  }
  
  async loadStats() {
    try {
      const response = await fetch('/api/v1/stats', {
        headers: { 'x-api-key': 'CGview98!!' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        this.displayStats(result.data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }
  
  displayStats(stats) {
    const statItems = [
      { value: stats.total || 0, label: 'Total Ratings' },
      { value: (stats.avg_score || 0).toFixed(1), label: 'Avg Score' },
      { value: stats.by_recommendation?.recommended || 0, label: 'Recommended' },
      { value: stats.by_recommendation?.neutral || 0, label: 'Neutral' },
      { value: stats.by_recommendation?.not_recommended || 0, label: 'Not Recommended' },
      { value: stats.by_recommendation?.highly_recommended || 0, label: 'Highly Rec.' }
    ];
    
    this.statsContainer.innerHTML = statItems.map(item => `
      <div class="stat-card">
        <div class="stat-value">${item.value}</div>
        <div class="stat-label">${item.label}</div>
      </div>
    `).join('');
  }
  
  async loadRatings() {
    try {
      const response = await fetch('/api/v1/ratings?limit=100', {
        headers: { 'x-api-key': 'CGview98!!' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        this.ratings = result.data.results || [];
        this.displayRatings(this.ratings);
      }
    } catch (err) {
      console.error('Error loading ratings:', err);
      if (this.ratingsTableBody) {
        this.ratingsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading ratings</td></tr>';
      }
    }
  }
  
  displayRatings(ratings) {
    if (!this.ratingsTableBody) return;
    
    if (ratings.length === 0) {
      this.ratingsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No ratings found</td></tr>';
      return;
    }
    
    this.ratingsTableBody.innerHTML = ratings.map(rating => `
      <tr>
        <td><code style="font-family: var(--font-mono); font-size: 12px;">${rating.id}</code></td>
        <td>${new Date(rating.created_at).toLocaleDateString()}</td>
        <td><strong style="color: var(--primary);">${rating.overall_score.toFixed(1)}</strong></td>
        <td>
          <span class="recommendation-badge badge-${rating.recommendation.toLowerCase().replace(' ', '-')}" style="font-size: 11px; padding: 4px 8px;">
            ${rating.recommendation}
          </span>
        </td>
        <td>
          ${rating.audio_path ? `<audio controls src="/uploads/${rating.audio_path}" style="max-width: 150px; height: 32px;"></audio>` : '-'}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="dashboard.deleteRating(${rating.id})" style="color: var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  filterRatings(query) {
    const filtered = this.ratings.filter(rating => {
      const searchStr = `${rating.recommendation} ${rating.overall_score}`.toLowerCase();
      return searchStr.includes(query.toLowerCase());
    });
    this.displayRatings(filtered);
  }
  
  async deleteRating(id) {
    if (!confirm('Are you sure you want to delete this rating?')) return;
    
    try {
      const response = await fetch(`/api/v1/ratings/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': 'CGview98!!' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.loadStats();
        this.loadRatings();
      } else {
        alert(result.error || 'Failed to delete rating');
      }
    } catch (err) {
      console.error('Error deleting rating:', err);
      alert('Network error. Please try again.');
    }
  }
}

// ============================================
// Initialize
// ============================================

let dashboard;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize copy buttons
  initCopyButtons();
  
  // Initialize audio functionality if on main page
  if ($('#uploadZone')) {
    const uploader = new AudioUploader();
    new AudioRecorder(uploader);
    new RatingSubmitter(uploader);
  }
  
  // Initialize dashboard if on dashboard page
  if ($('#statsContainer')) {
    dashboard = new Dashboard();
  }
});
