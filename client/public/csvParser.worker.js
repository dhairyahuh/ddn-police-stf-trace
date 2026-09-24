// Web Worker for CSV parsing
self.onmessage = function(e) {
  const { file, chunkSize = 10000 } = e.data;

  if (!file) {
    self.postMessage({ error: 'No file provided' });
    return;
  }

  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      const rows = [];
      let processed = 0;

      // Process in chunks to avoid blocking
      function processChunk() {
        const end = Math.min(processed + chunkSize, lines.length - 1);
        
        for (let i = processed + 1; i < end; i++) {
          if (!lines[i] || lines[i].trim() === '') continue;

          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          rows.push(row);
        }

        processed = end;

        // Send progress update
        self.postMessage({
          progress: (processed / (lines.length - 1)) * 100,
          rows: rows,
          done: processed >= lines.length - 1,
        });

        // Clear rows array for next chunk
        rows.length = 0;

        if (processed < lines.length - 1) {
          // Process next chunk
          setTimeout(processChunk, 0);
        }
      }

      processChunk();
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  };

  reader.onerror = function(error) {
    self.postMessage({ error: 'Error reading file: ' + error.message });
  };

  reader.readAsText(file);
};

