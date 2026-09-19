import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import router from './route/index';
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(router);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
