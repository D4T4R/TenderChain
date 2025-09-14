const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const natural = require('natural');
const compromise = require('compromise');
const { HfInference } = require('@huggingface/inference');
const logger = require('../utils/logger');

class DocumentProcessor {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN);
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.stopwords = natural.stopwords;
    
    // Initialize sentiment analyzer
    natural.SentimentAnalyzer.addSentiTokens = [
      'infrastructure', 'construction', 'development', 'maintenance',
      'supply', 'services', 'equipment', 'materials', 'labor',
      'project', 'contract', 'tender', 'bidding', 'procurement'
    ];
  }

  /**
   * Extract text from various file formats
   */
  async extractText(filePath, mimeType) {
    try {
      let text = '';
      
      switch (mimeType) {
        case 'application/pdf':
          text = await this.extractFromPDF(filePath);
          break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          text = await this.extractFromWord(filePath);
          break;
        case 'text/plain':
          text = await this.extractFromText(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
      
      return text;
    } catch (error) {
      logger.error('Text extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF
   */
  async extractFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  /**
   * Extract text from Word documents
   */
  async extractFromWord(filePath) {
    const result = await mammoth.extractRawText({path: filePath});
    return result.value;
  }

  /**
   * Extract text from plain text files
   */
  async extractFromText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Clean and preprocess text
   */
  preprocessText(text) {
    // Remove excessive whitespace and normalize
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove special characters but keep important punctuation
    text = text.replace(/[^\w\s.,!?;:()\-]/g, '');
    
    // Remove URLs and email addresses
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');
    
    return text;
  }

  /**
   * Extract key information using NLP
   */
  extractKeyInformation(text) {
    const doc = compromise(text);
    
    // Extract organizations, places, money, dates
    const organizations = doc.organizations().out('array');
    const places = doc.places().out('array');
    const money = doc.money().out('array');
    const dates = doc.dates().out('array');
    const numbers = doc.values().out('array');
    
    // Extract project-specific terms
    const projectTypes = this.extractProjectTypes(text);
    const workDescription = this.extractWorkDescription(text);
    const requirements = this.extractRequirements(text);
    
    return {
      organizations,
      places,
      money,
      dates,
      numbers,
      projectTypes,
      workDescription,
      requirements
    };
  }

  /**
   * Extract project types from text
   */
  extractProjectTypes(text) {
    const projectKeywords = {
      'construction': ['construction', 'building', 'structure', 'infrastructure'],
      'roads': ['road', 'highway', 'street', 'pavement', 'asphalt'],
      'bridges': ['bridge', 'overpass', 'underpass', 'flyover'],
      'water': ['water', 'pipeline', 'drainage', 'sewage', 'irrigation'],
      'electrical': ['electrical', 'power', 'lighting', 'wiring', 'transformer'],
      'maintenance': ['maintenance', 'repair', 'renovation', 'upgrade'],
      'supply': ['supply', 'procurement', 'purchase', 'equipment', 'materials']
    };
    
    const foundTypes = [];
    const lowerText = text.toLowerCase();
    
    for (const [type, keywords] of Object.entries(projectKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        foundTypes.push(type);
      }
    }
    
    return foundTypes;
  }

  /**
   * Extract work description sections
   */
  extractWorkDescription(text) {
    const workSections = [];
    const doc = compromise(text);
    
    // Look for sentences containing work-related keywords
    const sentences = doc.sentences().out('array');
    const workKeywords = ['work', 'construction', 'installation', 'maintenance', 'repair', 'supply', 'provide'];
    
    sentences.forEach(sentence => {
      if (workKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        workSections.push(sentence);
      }
    });
    
    return workSections.slice(0, 5); // Return top 5 relevant sentences
  }

  /**
   * Extract requirements and specifications
   */
  extractRequirements(text) {
    const requirements = [];
    const doc = compromise(text);
    
    // Look for requirement indicators
    const requirementPatterns = [
      /must\s+[^.]+/gi,
      /shall\s+[^.]+/gi,
      /required\s+[^.]+/gi,
      /specification[s]?[^.]+/gi,
      /minimum\s+[^.]+/gi
    ];
    
    requirementPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        requirements.push(...matches.map(match => match.trim()));
      }
    });
    
    return requirements.slice(0, 10); // Return top 10 requirements
  }

  /**
   * Generate summary using multiple techniques
   */
  async generateSummary(text, extractedInfo) {
    try {
      // First, try using Hugging Face API for advanced summarization
      let aiSummary = '';
      if (process.env.HUGGINGFACE_API_TOKEN) {
        try {
          aiSummary = await this.generateAISummary(text);
        } catch (error) {
          logger.warn('AI summarization failed, falling back to rule-based approach:', error.message);
        }
      }
      
      // Generate rule-based summary as fallback or complement
      const ruleBased = this.generateRuleBasedSummary(text, extractedInfo);
      
      // Combine both approaches
      const finalSummary = {
        overview: aiSummary || ruleBased.overview,
        workType: this.determineWorkType(extractedInfo),
        estimatedValue: this.extractEstimatedValue(extractedInfo),
        location: this.extractLocation(extractedInfo),
        keyRequirements: extractedInfo.requirements.slice(0, 3),
        timeline: this.extractTimeline(extractedInfo),
        projectScope: ruleBased.scope,
        confidence: this.calculateConfidence(text, extractedInfo)
      };
      
      return finalSummary;
    } catch (error) {
      logger.error('Summary generation error:', error);
      throw error;
    }
  }

  /**
   * Generate AI-powered summary using Hugging Face
   */
  async generateAISummary(text) {
    try {
      // Truncate text to reasonable length for API
      const maxLength = 4000;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      
      const result = await this.hf.summarization({
        model: 'facebook/bart-large-cnn',
        inputs: truncatedText,
        parameters: {
          max_length: 150,
          min_length: 50,
          do_sample: false
        }
      });
      
      return result.summary_text;
    } catch (error) {
      logger.warn('Hugging Face API error:', error);
      return null;
    }
  }

  /**
   * Generate rule-based summary
   */
  generateRuleBasedSummary(text, extractedInfo) {
    const sentences = compromise(text).sentences().out('array');
    const importantSentences = [];
    
    // Score sentences based on keyword presence and position
    const keywords = ['tender', 'work', 'construction', 'supply', 'maintenance', 'project'];
    
    sentences.forEach((sentence, index) => {
      let score = 0;
      const lowerSentence = sentence.toLowerCase();
      
      // Score based on keywords
      keywords.forEach(keyword => {
        if (lowerSentence.includes(keyword)) score += 2;
      });
      
      // Boost early sentences
      if (index < 5) score += 3;
      
      // Boost sentences with numbers/money
      if (/\d/.test(sentence)) score += 1;
      if (/(?:rs|₹|rupees|inr)/i.test(sentence)) score += 2;
      
      if (score > 3) {
        importantSentences.push({ sentence, score, index });
      }
    });
    
    // Sort by score and take top sentences
    importantSentences.sort((a, b) => b.score - a.score);
    
    const overview = importantSentences
      .slice(0, 3)
      .map(item => item.sentence)
      .join(' ');
    
    const scope = this.generateScopeDescription(extractedInfo);
    
    return { overview, scope };
  }

  /**
   * Determine work type from extracted information
   */
  determineWorkType(extractedInfo) {
    if (extractedInfo.projectTypes.length > 0) {
      return extractedInfo.projectTypes[0].charAt(0).toUpperCase() + extractedInfo.projectTypes[0].slice(1);
    }
    return 'General Work';
  }

  /**
   * Extract estimated value from text
   */
  extractEstimatedValue(extractedInfo) {
    if (extractedInfo.money && extractedInfo.money.length > 0) {
      return extractedInfo.money[0];
    }
    return 'Not specified';
  }

  /**
   * Extract location information
   */
  extractLocation(extractedInfo) {
    if (extractedInfo.places && extractedInfo.places.length > 0) {
      return extractedInfo.places[0];
    }
    return 'Not specified';
  }

  /**
   * Extract timeline information
   */
  extractTimeline(extractedInfo) {
    const timelineKeywords = ['days', 'weeks', 'months', 'completion', 'duration'];
    const relevantNumbers = extractedInfo.numbers.filter(num => 
      timelineKeywords.some(keyword => num.toLowerCase().includes(keyword))
    );
    
    if (relevantNumbers.length > 0) {
      return relevantNumbers[0];
    }
    
    if (extractedInfo.dates && extractedInfo.dates.length > 0) {
      return `Target completion: ${extractedInfo.dates[0]}`;
    }
    
    return 'Not specified';
  }

  /**
   * Generate project scope description
   */
  generateScopeDescription(extractedInfo) {
    let scope = '';
    
    if (extractedInfo.workDescription.length > 0) {
      scope = extractedInfo.workDescription.slice(0, 2).join(' ');
    } else if (extractedInfo.projectTypes.length > 0) {
      scope = `${extractedInfo.projectTypes.join(', ')} project`;
    } else {
      scope = 'Project scope not clearly specified in document';
    }
    
    return scope;
  }

  /**
   * Calculate confidence score for the extraction
   */
  calculateConfidence(text, extractedInfo) {
    let confidence = 0;
    
    // Base confidence on text length
    if (text.length > 1000) confidence += 20;
    if (text.length > 5000) confidence += 20;
    
    // Boost confidence based on extracted entities
    if (extractedInfo.organizations.length > 0) confidence += 15;
    if (extractedInfo.money.length > 0) confidence += 15;
    if (extractedInfo.places.length > 0) confidence += 10;
    if (extractedInfo.projectTypes.length > 0) confidence += 15;
    if (extractedInfo.requirements.length > 0) confidence += 5;
    
    return Math.min(confidence, 100);
  }

  /**
   * Process complete document
   */
  async processDocument(filePath, mimeType, metadata = {}) {
    try {
      logger.info(`Processing document: ${filePath}`);
      
      // Extract text
      const rawText = await this.extractText(filePath, mimeType);
      const cleanText = this.preprocessText(rawText);
      
      // Extract key information
      const extractedInfo = this.extractKeyInformation(cleanText);
      
      // Generate summary
      const summary = await this.generateSummary(cleanText, extractedInfo);
      
      // Return comprehensive result
      return {
        originalText: rawText,
        cleanText,
        extractedInfo,
        summary,
        metadata: {
          ...metadata,
          processedAt: new Date(),
          textLength: cleanText.length,
          confidence: summary.confidence
        }
      };
    } catch (error) {
      logger.error(`Document processing failed for ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new DocumentProcessor();
