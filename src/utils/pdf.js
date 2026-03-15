// ── PDF UTILITY ──
// Extracts text from uploaded PDF or TXT files
const PDFUtil = {

  async extractText(file) {
    if (!file) return null;

    // TXT files — read directly
    if (file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.slice(0, 4000));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    }

    // PDF files — use pdf.js from CDN
    if (file.type === 'application/pdf') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = await PDFUtil._parsePDF(e.target.result);
            resolve(text);
          } catch (err) {
            // Fallback: return filename as minimal context
            resolve(`[PDF uploaded: ${file.name}. Content extraction failed — agents will discuss the topic generally.]`);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF'));
        reader.readAsArrayBuffer(e.target.result ? null : file);
      });
    }

    return null;
  },

  async extractFromArrayBuffer(arrayBuffer) {
    // Try pdf.js if available
    if (window.pdfjsLib) {
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 8); // limit pages for context window

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }

        return fullText.slice(0, 4000); // 4000 chars fits well in context
      } catch (e) {
        throw new Error('PDF parse failed');
      }
    }
    throw new Error('pdf.js not loaded');
  },

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsArrayBuffer(file);
    });
  },

  async processUpload(file) {
    try {
      if (file.type === 'text/plain') {
        const text = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.onerror = rej;
          r.readAsText(file);
        });
        return text.slice(0, 4000);
      }

      if (file.type === 'application/pdf') {
        // Load pdf.js dynamically if not already loaded
        if (!window.pdfjsLib) {
          await PDFUtil._loadPDFJS();
        }
        const buffer = await PDFUtil.readFileAsArrayBuffer(file);
        return await PDFUtil.extractFromArrayBuffer(buffer);
      }

      return `[File: ${file.name} — content type not supported, discussing topic generally]`;
    } catch (e) {
      console.warn('PDF extraction error:', e);
      return `[PDF: ${file.name} uploaded — agents will discuss the topic based on the title and your input]`;
    }
  },

  _loadPDFJS() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
};
