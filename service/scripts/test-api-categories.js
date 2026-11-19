const http = require('http');

http.get('http://localhost:3000/api/categories', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(raw);
      console.log('API Status: Success =', json.success, 'Count =', json.data?.length);
      json.data.forEach(c => {
        const isPngBase64 = c.image && c.image.startsWith('data:image/png;base64,');
        console.log(`- ${c.name} [order: ${c.order}]: ${isPngBase64 ? 'PNG BASE64 (' + c.image.length + ' chars)' : c.image?.slice(0, 30)}`);
      });
    } catch (e) {
      console.error('Error parsing json:', e);
    }
  });
}).on('error', console.error);

