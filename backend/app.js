// 讀取專案根目錄下的 .env 檔案，並把裡面定義的變數載入到 Node.js 的 process.env 環境變數中
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const db = require('./data/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

const app = express();
const PORT = process.env.PORT || 3000;
const apiSpec = YAML.parse(
  fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8')
);

app.disable('x-powered-by');

// Middleware
// Location這個header用來放新資源的位置
// X-Total-Count這個header用來放列表的筆數
app.use(cors({ exposedHeaders: ['Location', 'X-Total-Count'] }));
app.use(express.json());

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Fail at startup with a clear message if the database is unreachable.
db.query('SELECT 1')
  .then(() => {
    app.listen(PORT, (err) => {
      if (err) throw err;
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
