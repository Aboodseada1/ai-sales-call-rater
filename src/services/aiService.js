const fs = require('fs');
const path = require('path');

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'https://litellm.scorpion.codes/v1';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-ybMe7zm8jzvgXChDOXn1eQ';
const LITELLM_PRIMARY_MODEL = process.env.LITELLM_PRIMARY_MODEL || 'gemini-3.1-pro-preview-litellm';
const LITELLM_MODEL = process.env.LITELLM_MODEL || 'gemini-2.5-flash-litellm';
const LITELLM_FALLBACK_MODEL = process.env.LITELLM_FALLBACK_MODEL || 'gemini-2.5-pro-litellm';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ultra-strict evaluation prompt for hiring native-level English speakers
const SYSTEM_PROMPT = `You are an elite hiring evaluator for a US cold calling operation. You ONLY hire speakers who sound indistinguishable from native US English speakers. Your standards are extremely high.

⚠️ CRITICAL FIRST STEP - LANGUAGE DETECTION:
Before evaluating, you MUST determine what language is being spoken:
1. If the audio is NOT in English (Arabic, Spanish, French, etc.) → REJECT IMMEDIATELY
2. If the audio contains mixed English and another language → Score ONLY the English portions
3. If there is NO speech (music, silence, noise) → REJECT IMMEDIATELY
4. If the audio IS in English → Proceed with full evaluation

For NON-ENGLISH audio, respond with:
{
  "overall_score": 0.0,
  "transcription": "No English speech detected",
  "criteria": {
    "phone_intelligibility": 0,
    "pronunciation_clarity": 0,
    "business_english_delivery": 0,
    "confidence_sales_tone": 0,
    "pace_smoothness": 0,
    "recording_quality": 0
  },
  "summary": "This candidate spoke in [LANGUAGE], not English. Cannot evaluate for an English call center position.",
  "strengths": [],
  "weaknesses": ["Did not speak English - this is an English-only call center position"],
  "recommendation": "Not Recommended"
}

For NO SPEECH/SILENCE, respond with:
{
  "overall_score": 0.0,
  "transcription": "No speech detected",
  "criteria": {
    "phone_intelligibility": 0,
    "pronunciation_clarity": 0,
    "business_english_delivery": 0,
    "confidence_sales_tone": 0,
    "pace_smoothness": 0,
    "recording_quality": 0
  },
  "summary": "No intelligible speech detected in the audio. Cannot evaluate.",
  "strengths": [],
  "weaknesses": ["No speech detected"],
  "recommendation": "Not Recommended"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF THE AUDIO IS IN ENGLISH, EVALUATE EXTREMELY STRICTLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Main question:
Would a typical US business owner IMMEDIATELY assume this caller is American, born and raised in the US?

CRITICAL: We are hiring for NATIVE-LEVEL English only. Any trace of non-native speech patterns should result in lower scores.

SCORING SCALE (1-10):
• 10 = Indistinguishable from a native US speaker. Perfect.
• 9 = Near-native, extremely minor imperfections only an expert would catch
• 8 = Very good, but a keen listener might detect slight non-native patterns
• 7 = Good, but clearly not native to most US listeners
• 6 = Understandable but noticeable non-native patterns
• 5 = Understandable with effort, clearly non-native
• 4 = Difficult to understand, frequent confusion likely
• 3 = Hard to understand, major pronunciation/grammar issues
• 2 = Very hard to understand, unintelligible portions
• 1 = Nearly unintelligible

Primary scoring criteria:
- phone_intelligibility: Can a US business owner understand EVERY word instantly?
- pronunciation_clarity: Is pronunciation indistinguishable from a native US speaker?
- business_english_delivery: Does it sound like natural, native US business English?
- confidence_sales_tone: Do they sound like a confident US sales professional?
- pace_smoothness: Is the rhythm and timing identical to native US speech?
- recording_quality: Is the recording clear and usable?

STRICT CALIBRATION RULES:
• A TRUE native US English speaker scores 9-10 on ALL criteria
• ANY detectable non-native patterns = maximum score of 7 on affected criteria
• If a US business owner would EVER think "what did they say?" = score below 6
• If the speaker sounds even slightly "off" to American ears = do NOT score above 8
• When in doubt, score LOWER. We need native-level speakers only.

PASS THRESHOLD:
• "Highly Recommended" = Overall 9.0+, ALL criteria 8+, sounds completely American
• "Recommended" = Overall 8.0-8.9, most criteria 8+, near-native but not perfect
• "Neutral" = Overall 6.0-7.9, good but detectably non-native
• "Not Recommended" = Overall below 6.0, not native-level

DO NOT INFLATE SCORES. If they don't sound American, they don't pass with high scores.

Do not identify nationality, ethnicity, race, gender, age, religion, disability, or country.
Do not name the accent.
Do not say where the speaker is from.

Respond ONLY in this exact JSON format:
{
  "overall_score": 7.8,
  "transcription": "[00:00] Hello, this is John calling from ABC Company...\n[00:05] I wanted to reach out about our new services...",
  "criteria": {
    "phone_intelligibility": 8,
    "pronunciation_clarity": 7,
    "business_english_delivery": 8,
    "confidence_sales_tone": 8,
    "pace_smoothness": 7,
    "recording_quality": 8
  },
  "summary": "2-3 sentences evaluating if they sound native-level",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "weakness 2"],
  "recommendation": "Recommended"
}`;

/**
 * Get audio format for Gemini
 */
function getAudioFormat(format) {
  const formats = {
    'mp3': 'mp3',
    'wav': 'wav',
    'ogg': 'ogg',
    'mp4': 'mp4',
    'm4a': 'mp4',
    'webm': 'webm'
  };
  return formats[format] || 'mp3';
}

/**
 * Rate audio using Gemini via LiteLLM with OpenAI input_audio format
 */
async function rateAudio(filePath, audioFormat) {
  const startTime = Date.now();
  
  try {
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Audio = fileBuffer.toString('base64');
    const format = getAudioFormat(audioFormat);
    
    console.log(`Audio file: ${filePath}, format: ${audioFormat}, size: ${fileBuffer.length} bytes`);
    
    const models = [LITELLM_PRIMARY_MODEL, LITELLM_MODEL, LITELLM_FALLBACK_MODEL];
    let lastError = null;
    
    for (const model of models) {
      try {
        console.log(`Attempting rating with model: ${model}`);
        
        // Use OpenAI input_audio format (works with LiteLLM -> Gemini)
        const response = await fetch(`${LITELLM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LITELLM_API_KEY}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: base64Audio,
                      format: format
                    }
                  },
                  {
                    type: 'text',
                    text: SYSTEM_PROMPT
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content in LiteLLM response');
        }

        const rating = parseRatingResponse(content);
        
        const elapsed = Date.now() - startTime;
        console.log(`Rating completed in ${elapsed}ms using model ${model}`);
        
        return {
          success: true,
          rating,
          model,
          elapsed
        };
        
      } catch (error) {
        console.error(`Error with model ${model}:`, error.message);
        lastError = error;
        
        if (model === LITELLM_FALLBACK_MODEL) {
          break;
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Failed to rate audio'
    };
    
  } catch (error) {
    console.error('Rate audio error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse JSON from AI response
 */
function parseRatingResponse(content) {
  let jsonStr = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    if (typeof parsed.overall_score !== 'number') {
      throw new Error('Missing or invalid overall_score');
    }
    if (!parsed.criteria || typeof parsed.criteria !== 'object') {
      throw new Error('Missing or invalid criteria');
    }
    if (!['Highly Recommended', 'Recommended', 'Neutral', 'Not Recommended'].includes(parsed.recommendation)) {
      parsed.recommendation = 'Neutral';
    }
    
    return {
      overall_score: parsed.overall_score,
      transcription: parsed.transcription || 'No transcription provided',
      criteria: {
        phone_intelligibility: parsed.criteria.phone_intelligibility || 0,
        pronunciation_clarity: parsed.criteria.pronunciation_clarity || 0,
        business_english_delivery: parsed.criteria.business_english_delivery || 0,
        confidence_sales_tone: parsed.criteria.confidence_sales_tone || 0,
        pace_smoothness: parsed.criteria.pace_smoothness || 0,
        recording_quality: parsed.criteria.recording_quality || 0
      },
      summary: parsed.summary || 'No summary provided',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      recommendation: parsed.recommendation,
      raw: content
    };
  } catch (parseError) {
    console.error('Failed to parse rating response:', parseError.message);
    console.error('Raw content:', content);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }
}

/**
 * Rate audio with retry
 */
async function rateAudioWithRetry(filePath, audioFormat, maxRetries = 2) {
  let lastResult = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await rateAudio(filePath, audioFormat);
      
      if (result.success) {
        return result;
      }
      
      lastResult = result;
    } catch (error) {
      console.error(`Rating attempt ${attempt + 1} failed:`, error.message);
      lastResult = { success: false, error: error.message };
    }
    
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return lastResult;
}

/**
 * Delete an audio file
 */
function deleteAudioFile(filename) {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted audio file: ${filename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting audio file ${filename}:`, error.message);
    return false;
  }
}

/**
 * Clean up old audio files (older than specified days)
 */
function cleanupOldFiles(daysOld = 7) {
  const uploadDir = path.resolve(UPLOAD_DIR);
  
  if (!fs.existsSync(uploadDir)) {
    console.log('Upload directory does not exist');
    return { deleted: 0, errors: 0 };
  }
  
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let errors = 0;
  
  try {
    const files = fs.readdirSync(uploadDir);
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old file: ${file}`);
          deleted++;
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err.message);
        errors++;
      }
    }
    
    console.log(`Cleanup complete: ${deleted} files deleted, ${errors} errors`);
    return { deleted, errors };
    
  } catch (error) {
    console.error('Cleanup error:', error.message);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Get upload directory size
 */
function getUploadDirSize() {
  const uploadDir = path.resolve(UPLOAD_DIR);
  
  if (!fs.existsSync(uploadDir)) {
    return { files: 0, size: 0, sizeFormatted: '0 B' };
  }
  
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    const files = fs.readdirSync(uploadDir);
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        }
      } catch (err) {
        // Skip files we can't read
      }
    }
  } catch (error) {
    console.error('Error getting upload dir size:', error.message);
  }
  
  const sizeFormatted = formatBytes(totalSize);
  return { files: fileCount, size: totalSize, sizeFormatted };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  rateAudio,
  rateAudioWithRetry,
  parseRatingResponse,
  deleteAudioFile,
  cleanupOldFiles,
  getUploadDirSize,
  LITELLM_PRIMARY_MODEL,
  LITELLM_MODEL,
  LITELLM_FALLBACK_MODEL
};
