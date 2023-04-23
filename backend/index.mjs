import express from 'express';
import {
  S3,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import cors from 'cors';
import dotenv from 'dotenv';


dotenv.config();
const app = express();
const port = 3010;
// allow localhost:5173 to access this server
app.use(cors({ origin: 'http://localhost:5173' }));

const BUCKET_REGION = process.env.BUCKET_REGION ||'eu-west-1';

const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;

const s3 = new S3({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

app.get('/api/:bucket', async (req, res) => {
  let { prefix } = req.query;
  prefix = decodeURIComponent(prefix);
  let { bucket } = req.params;

  try {
    const data = await s3.listObjectsV2({
      Bucket: bucket,
      Delimiter: '/',
      Prefix: prefix !== '/' ? prefix : '',
    });
    res.json(data);
  } catch (error) {
    res.status(500).send({ message: `Internal Server Error.\n\n${error}` });
  }
});

app.get('/api/:bucket/item', async (req, res) => {
  let { itemKey } = req.query;
  let { bucket } = req.params;
  itemKey = decodeURIComponent(itemKey);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: itemKey,
  });

  try {
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL expiration
    res.json(url);
  } catch (error) {
    res.status(500).send({ message: `Internal Server Error.\n\n${error}` });
  }

});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
